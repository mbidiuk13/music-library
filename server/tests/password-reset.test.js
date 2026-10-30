/**
 * @file Інтеграційні тести відновлення пароля: POST /api/auth/forgot-password
 * і POST /api/auth/reset-password. Надсилання листів підмінено, тому SMTP не потрібен.
 */

import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import createApp from '../src/app.js';
import { closePool, query } from '../src/db/pool.js';
import mailer from '../src/services/mailer.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { PASSWORD_MESSAGES } from '../src/modules/auth/password.rules.js';
import { describeDb, uniqueEmail } from './helpers/db.js';

const app = createApp();
const OLD_PASSWORD = 'Str0ng!Pass';
const NEW_PASSWORD = 'N3w!Secret#';
const INVALID_LINK = 'Посилання для відновлення пароля недійсне або його строк дії минув';

/**
 * Реєструє користувача з паролем OLD_PASSWORD.
 * @returns {Promise<{id: string, email: string}>} створений користувач.
 */
async function registerUser() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: uniqueEmail('reset'),
      username: 'Тест',
      password: OLD_PASSWORD,
      passwordConfirm: OLD_PASSWORD,
      acceptTerms: true,
    });
  return res.body.user;
}

/**
 * Запитує відновлення пароля і повертає токен із посилання в «надісланому» листі.
 * @param {string} email - email користувача.
 * @returns {Promise<string>} токен відновлення.
 */
async function requestResetToken(email) {
  const send = jest.spyOn(mailer, 'sendPasswordResetEmail').mockResolvedValue();
  await request(app).post('/api/auth/forgot-password').send({ email }).expect(200);
  const { link } = send.mock.calls[0][0];
  return new URL(link).searchParams.get('token');
}

/**
 * Надсилає запит на зміну пароля.
 * @param {string} token - токен відновлення.
 * @param {string} [password=NEW_PASSWORD] - новий пароль (і його підтвердження).
 * @returns {Promise<import('supertest').Response>} відповідь сервера.
 */
function resetPassword(token, password = NEW_PASSWORD) {
  return request(app)
    .post('/api/auth/reset-password')
    .send({ token, password, passwordConfirm: password });
}

/**
 * Перевіряє, чи вдається вхід із вказаним паролем.
 * @param {string} email - email користувача.
 * @param {string} password - пароль.
 * @returns {Promise<number>} HTTP-статус відповіді на вхід.
 */
async function loginStatus(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.status;
}

afterEach(() => jest.restoreAllMocks());
afterAll(() => closePool());

describeDb('POST /api/auth/forgot-password', () => {
  test('для зареєстрованого email надсилає лист із посиланням на клієнт', async () => {
    const user = await registerUser();
    const send = jest.spyOn(mailer, 'sendPasswordResetEmail').mockResolvedValue();

    const res = await request(app).post('/api/auth/forgot-password').send({ email: user.email });

    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    const { to, link } = send.mock.calls[0][0];
    expect(to).toBe(user.email);
    expect(link).toMatch(/^http:\/\/localhost:5173\/reset-password\?token=.+/);
  });

  test('для незареєстрованого email — та сама відповідь 200, лист не надсилається', async () => {
    const user = await registerUser();
    const send = jest.spyOn(mailer, 'sendPasswordResetEmail').mockResolvedValue();

    const known = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: uniqueEmail('nobody') });

    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('збій поштового сервера не змінює відповідь', async () => {
    const user = await registerUser();
    jest.spyOn(mailer, 'sendPasswordResetEmail').mockRejectedValue(new Error('SMTP недоступний'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    expect(res.status).toBe(200);
  });

  test('400: некоректний формат email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describeDb('POST /api/auth/reset-password', () => {
  test('200: змінює пароль — новий працює, старий ні', async () => {
    const user = await registerUser();
    const token = await requestResetToken(user.email);

    const res = await resetPassword(token);

    expect(res.status).toBe(200);
    expect(await loginStatus(user.email, NEW_PASSWORD)).toBe(200);
    expect(await loginStatus(user.email, OLD_PASSWORD)).toBe(401);
  });

  test('токен одноразовий: повторне використання → 400', async () => {
    const user = await registerUser();
    const token = await requestResetToken(user.email);
    await resetPassword(token).expect(200);

    const again = await resetPassword(token, 'An0ther!Pass');
    expect(again.status).toBe(400);
    expect(again.body.error).toEqual({ code: 'INVALID_RESET_TOKEN', message: INVALID_LINK });
    expect(await loginStatus(user.email, NEW_PASSWORD)).toBe(200);
  });

  test('прострочений токен → 400', async () => {
    const user = await registerUser();
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
    const expired = jwt.sign(
      { sub: user.id, purpose: 'reset' },
      process.env.JWT_SECRET + rows[0].password_hash,
      { expiresIn: -10 },
    );

    const res = await resetPassword(expired);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  test.each([
    [
      'токен доступу замість токена відновлення',
      (user) => signAccessToken({ ...user, role: 'user' }),
    ],
    [
      'підписаний лише JWT_SECRET (без хеша пароля)',
      (user) => jwt.sign({ sub: user.id, purpose: 'reset' }, process.env.JWT_SECRET),
    ],
    ['пошкоджений рядок', () => 'not.a.jwt'],
    ['sub не є UUID', () => jwt.sign({ sub: 'abc', purpose: 'reset' }, 'x')],
  ])('%s → 400', async (_, makeToken) => {
    const user = await registerUser();
    const res = await resetPassword(makeToken(user));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
    expect(await loginStatus(user.email, OLD_PASSWORD)).toBe(200);
  });

  test('400: новий пароль перевіряється за тими самими правилами', async () => {
    const user = await registerUser();
    const token = await requestResetToken(user.email);

    const res = await resetPassword(token, 'Пароль123!!');

    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({
      field: 'password',
      message: PASSWORD_MESSAGES.charset,
    });
    expect(await loginStatus(user.email, OLD_PASSWORD)).toBe(200);
  });

  test('400: паролі не збігаються', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'x', password: NEW_PASSWORD, passwordConfirm: 'інший' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({
      field: 'passwordConfirm',
      message: 'Паролі не збігаються',
    });
  });
});
