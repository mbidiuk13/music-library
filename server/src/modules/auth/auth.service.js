/**
 * @module modules/auth/auth.service
 * @description Бізнес-логіка Auth Controller: реєстрація (UC-1), вхід (UC-2),
 * отримання поточного користувача. Паролі зберігаються лише як bcrypt-хеш
 * (saltRounds = 10) і ніколи не повертаються в API та не логуються.
 */

import bcrypt from 'bcrypt';
import config from '../../config/index.js';
import { transaction } from '../../db/pool.js';
import AppError from '../../utils/AppError.js';
import { signAccessToken } from '../../utils/jwt.js';
import * as repository from './auth.repository.js';

/** Код помилки PostgreSQL «порушення унікальності» (unique_violation). */
const UNIQUE_VIOLATION = '23505';

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
