/**
 * @module modules/auth/auth.service
 * @description Бізнес-логіка Auth Controller: реєстрація (UC-1), вхід (UC-2),
 * отримання поточного користувача, відновлення пароля через посилання в листі. Паролі зберігаються лише як bcrypt-хеш
 * (saltRounds = 10) і ніколи не повертаються в API та не логуються.
 */

import bcrypt from 'bcrypt';
import config from '../../config/index.js';
import { transaction } from '../../db/pool.js';
import mailer from '../../services/mailer.js';
import AppError from '../../utils/AppError.js';
import {
  readTokenSubject,
  signAccessToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
} from '../../utils/jwt.js';
import * as repository from './auth.repository.js';

/** Код помилки PostgreSQL «порушення унікальності» (unique_violation). */
const UNIQUE_VIOLATION = '23505';

/** Формат UUID (ідентифікатор користувача з токена перевіряється перед запитом до БД). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Хеш-заглушка для входу з неіснуючим email: bcrypt.compare виконується завжди,
 * тож за часом відповіді не можна визначити, чи зареєстровано адресу.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equalizer-password', config.bcryptSaltRounds);

/**
 * Залишає лише ті поля користувача, які можна передати клієнту.
 * @param {{id: string, email: string, username: string, role: string}} user - рядок таблиці users.
 * @returns {{id: string, email: string, username: string, role: string}} публічні дані.
 */
export function toPublicUser(user) {
  return { id: user.id, email: user.email, username: user.username, role: user.role };
}

/**
 * Реєструє користувача: в одній транзакції створює запис у users і плейлист «Улюблені».
 * Якщо будь-який крок не вдався, жодних змін у БД не залишається.
 * @param {{email: string, username: string, password: string}} data - перевірені дані форми.
 * @returns {Promise<{token: string, user: object}>} токен доступу і публічні дані користувача.
 * @throws {AppError} 409 EMAIL_TAKEN, якщо email уже зареєстровано.
 */
export async function register({ email, username, password }) {
  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);

  let user;
  try {
    user = await transaction(async (client) => {
      const created = await repository.insertUser(client, { email, username, passwordHash });
      await repository.insertPlaylist(client, created.id, config.favoritesTitle);
      return created;
    });
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION && err.constraint === 'users_email_key') {
      throw new AppError(
        409,
        'EMAIL_TAKEN',
        'Користувач з такою електронною поштою вже зареєстрований',
      );
    }
    throw err;
  }

  return { token: signAccessToken(user), user: toPublicUser(user) };
}

/**
 * Автентифікує користувача за email і паролем.
 * Для неіснуючого email і хибного пароля повертається однакова помилка.
 * @param {{email: string, password: string}} credentials - email (у нижньому регістрі) і пароль.
 * @returns {Promise<{token: string, user: object}>} токен доступу і публічні дані користувача.
 * @throws {AppError} 401 INVALID_CREDENTIALS «Невірний логін або пароль».
 */
export async function login({ email, password }) {
  const user = await repository.findUserByEmail(email);
  const passwordMatches = await bcrypt.compare(
    password,
    user ? user.password_hash : DUMMY_PASSWORD_HASH,
  );
  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Невірний логін або пароль');
  }
  return { token: signAccessToken(user), user: toPublicUser(user) };
}

/**
 * Повертає актуальні дані поточного користувача (відновлення сесії після перезавантаження).
 * @param {string} userId - UUID із токена.
 * @returns {Promise<object>} публічні дані користувача.
 * @throws {AppError} 401 INVALID_TOKEN, якщо користувача вже не існує.
 */
export async function getCurrentUser(userId) {
  const user = await repository.findUserById(userId);
  if (!user) {
    throw new AppError(
      401,
      'INVALID_TOKEN',
      'Сесія недійсна або завершилася. Увійдіть до системи знову',
    );
  }
  return toPublicUser(user);
}

/**
 * Створює помилку «недійсне посилання для відновлення пароля».
 * @returns {AppError} 400 INVALID_RESET_TOKEN.
 */
function invalidResetToken() {
  return new AppError(
    400,
    'INVALID_RESET_TOKEN',
    'Посилання для відновлення пароля недійсне або його строк дії минув',
  );
}

/**
 * Надсилає лист із посиланням `${CLIENT_URL}/reset-password?token=…`, якщо email зареєстровано.
 * Для незареєстрованого email нічого не робить, а відповідь сервера однакова в обох випадках,
 * тож за нею не можна дізнатися, чи існує обліковий запис. Лист надсилається у фоні,
 * щоб час відповіді не залежав від роботи поштового сервера.
 * @param {string} email - email у нижньому регістрі.
 * @returns {Promise<void>}
 */
export async function requestPasswordReset(email) {
  const user = await repository.findUserByEmail(email);
  if (!user) return;

  const token = signPasswordResetToken(user);
  const link = `${config.clientUrl}/reset-password?token=${encodeURIComponent(token)}`;
  mailer
    .sendPasswordResetEmail({ to: user.email, username: user.username, link })
    .catch((err) =>
      console.error('Не вдалося надіслати лист для відновлення пароля:', err.message),
    );
}

/**
 * Встановлює новий пароль за токеном із листа. Токен одноразовий: після зміни пароля
 * змінюється хеш, яким він підписаний.
 * @param {{token: string, password: string}} data - токен і новий (перевірений) пароль.
 * @returns {Promise<void>}
 * @throws {AppError} 400 INVALID_RESET_TOKEN, якщо токен недійсний, прострочений або вже використаний.
 */
export async function resetPassword({ token, password }) {
  const userId = readTokenSubject(token);
  if (!userId || !UUID_PATTERN.test(userId)) throw invalidResetToken();

  const user = await repository.findUserById(userId);
  if (!user) throw invalidResetToken();
  try {
    verifyPasswordResetToken(token, user.password_hash);
  } catch {
    throw invalidResetToken();
  }

  const newHash = await bcrypt.hash(password, config.bcryptSaltRounds);
  const changed = await repository.updatePasswordHash(user.id, user.password_hash, newHash);
  if (!changed) throw invalidResetToken();
}
