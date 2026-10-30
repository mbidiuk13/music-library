/**
 * @file Інтеграційні тести Auth Controller (реєстрація, вхід, поточний користувач)
 * і захисту адміністративних маршрутів. Працюють з окремою тестовою БД (TEST_DATABASE_URL).
 */

import request from 'supertest';
import createApp from '../src/app.js';
import { closePool, query } from '../src/db/pool.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { PASSWORD_MESSAGES } from '../src/modules/auth/password.rules.js';
import { describeDb, uniqueEmail } from './helpers/db.js';

const app = createApp();
const PASSWORD = 'Str0ng!Pass';

/**
 * Формує коректне тіло запиту реєстрації; окремі поля можна перевизначити.
 * @param {object} [overrides] - поля, які треба замінити.
 * @returns {object} тіло запиту POST /api/auth/register.
 */
function registrationBody(overrides = {}) {
  return {
    email: uniqueEmail(),
    username: 'Марія',
    password: PASSWORD,
    passwordConfirm: PASSWORD,
    acceptTerms: true,
    ...overrides,
  };
}

/**
 * Повертає повідомлення про помилку для поля з відповіді 400.
 * @param {import('supertest').Response} res - відповідь сервера.
 * @param {string} field - назва поля.
 * @returns {string|undefined} повідомлення або undefined.
 */
function fieldError(res, field) {
  return res.body.error.details?.find((detail) => detail.field === field)?.message;
}

afterAll(() => closePool());

describeDb('POST /api/auth/register', () => {
  test('201: створює користувача з роллю user, повертає токен і без хеша пароля', async () => {
    const body = registrationBody();
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: expect.any(String),
      email: body.email,
      username: 'Марія',
      role: 'user',
    });
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  test('пароль зберігається лише як bcrypt-хеш (saltRounds = 10)', async () => {
    const body = registrationBody();
    await request(app).post('/api/auth/register').send(body).expect(201);

    const { rows } = await query('SELECT password_hash FROM users WHERE email = $1', [body.email]);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$10\$/);
    expect(rows[0].password_hash).not.toContain(PASSWORD);
  });

  test('в одній транзакції створюється плейлист «Улюблені»', async () => {
    const res = await request(app).post('/api/auth/register').send(registrationBody());

    const { rows } = await query('SELECT title FROM playlist WHERE user_id = $1', [
      res.body.user.id,
    ]);
    expect(rows).toEqual([{ title: 'Улюблені' }]);
  });

  test('email зберігається в нижньому регістрі; повтор в іншому регістрі → 409', async () => {
    const email = uniqueEmail('Case');
    const first = await request(app)
      .post('/api/auth/register')
      .send(registrationBody({ email: `  ${email.toUpperCase()}  ` }));
    expect(first.status).toBe(201);
    expect(first.body.user.email).toBe(email.toLowerCase());

    const second = await request(app).post('/api/auth/register').send(registrationBody({ email }));
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('EMAIL_TAKEN');
  });

  test.each([
    ['email', { email: 'not-an-email' }, 'Некоректна адреса електронної пошти'],
    ['email', { email: ['a@b.c'] }, 'Введіть електронну пошту'],
    ['username', { username: '   ' }, "Введіть ім'я"],
    ['username', { username: 'я'.repeat(101) }, "Ім'я не може бути довшим за 100 символів"],
    [
      'password',
      { password: 'Пароль123!!', passwordConfirm: 'Пароль123!!' },
      PASSWORD_MESSAGES.charset,
    ],
    ['password', { password: 'Sh0rt!', passwordConfirm: 'Sh0rt!' }, PASSWORD_MESSAGES.length],
    [
      'password',
      { password: 'abcdefghij1', passwordConfirm: 'abcdefghij1' },
      PASSWORD_MESSAGES.special,
    ],
    ['passwordConfirm', { passwordConfirm: 'Str0ng!Pas' }, 'Паролі не збігаються'],
    ['acceptTerms', { acceptTerms: false }, 'Потрібно погодитися з умовами використання'],
    ['acceptTerms', { acceptTerms: 'true' }, 'Потрібно погодитися з умовами використання'],
  ])('400: некоректне поле %s (%j)', async (field, overrides, message) => {
    const body = registrationBody(overrides);
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(fieldError(res, field)).toBe(message);
  });

  test('400: некоректні дані не створюють користувача', async () => {
    const body = registrationBody({ passwordConfirm: 'інший' });
    await request(app).post('/api/auth/register').send(body).expect(400);

    const { rows } = await query('SELECT 1 FROM users WHERE email = $1', [body.email]);
    expect(rows).toHaveLength(0);
  });
});

describeDb('POST /api/auth/login і GET /api/auth/me', () => {
  const account = registrationBody();

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send(account).expect(201);
  });

  test('200: правильні дані → токен, з яким працює /me', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email.toUpperCase(), password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ email: account.email, role: 'user' });

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user).toEqual(login.body.user);
  });

  test('401: однакова помилка для хибного пароля й неіснуючого email', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: 'Wr0ng!Pass' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('nobody'), password: PASSWORD });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Невірний логін або пароль',
      });
    }
  });

  test('400: порожні поля входу', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: ' ', password: '' });
    expect(res.status).toBe(400);
    expect(fieldError(res, 'email')).toBe('Введіть електронну пошту');
    expect(fieldError(res, 'password')).toBe('Введіть пароль');
  });

  test('/me без токена → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('/me з токеном видаленого користувача → 401', async () => {
    const token = signAccessToken({
      id: '00000000-0000-4000-8000-000000000000',
      role: 'user',
      email: 'gone@test.local',
    });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('доступ до /api/admin/* (RBAC)', () => {
  const userToken = signAccessToken({
    id: '11111111-1111-4111-8111-111111111111',
    role: 'user',
    email: 'u@test.local',
  });
  const adminToken = signAccessToken({
    id: '22222222-2222-4222-8222-222222222222',
    role: 'admin',
    email: 'a@test.local',
  });

  test('без токена → 401', async () => {
    const res = await request(app).get('/api/admin/tracks');
    expect(res.status).toBe(401);
  });

  test('звичайний користувач → 403', async () => {
    const res = await request(app)
      .get('/api/admin/tracks')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('адміністратор проходить перевірку ролі', async () => {
    const res = await request(app)
      .get('/api/admin/unknown')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
