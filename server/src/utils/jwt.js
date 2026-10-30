/**
 * @module utils/jwt
 * @description Створення та перевірка JSON Web Token (розділ 3.4 ПЗ). Токен доступу містить
 * `{ sub: userId, role, email }`, підписується алгоритмом HS256 ключем JWT_SECRET з .env
 * і має обмежений строк дії JWT_EXPIRES_IN (за замовчуванням 24 год).
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/** Єдиний дозволений алгоритм підпису (захист від підміни алгоритму в заголовку токена). */
const ALGORITHM = 'HS256';

/**
 * Повертає секретний ключ підпису токенів.
 * @returns {string} значення JWT_SECRET.
 * @throws {Error} якщо JWT_SECRET не задано в .env.
 */
export function getJwtSecret() {
  if (!config.jwt.secret) {
    throw new Error('Не задано JWT_SECRET у файлі .env (див. .env.example)');
  }
  return config.jwt.secret;
}

/**
 * Створює токен доступу для користувача.
 * @param {{id: string, role: string, email: string}} user - користувач з БД.
 * @returns {string} підписаний JWT.
 */
export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, getJwtSecret(), {
    algorithm: ALGORITHM,
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Перевіряє підпис і строк дії токена доступу.
 * @param {string} token - JWT із заголовка Authorization.
 * @returns {{sub: string, role: string, email: string}} корисне навантаження токена.
 * @throws {import('jsonwebtoken').JsonWebTokenError} якщо підпис недійсний або строк дії минув.
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret(), { algorithms: [ALGORITHM] });
}

/** Призначення токена відновлення пароля (відрізняє його від токена доступу). */
const RESET_PURPOSE = 'reset';

/**
 * Створює одноразовий токен відновлення пароля `{ sub, purpose: 'reset' }` строком на 15 хв.
 * Ключ підпису — JWT_SECRET + поточний хеш пароля: після зміни пароля хеш стає іншим,
 * і старий токен автоматично стає недійсним (окрема таблиця токенів не потрібна).
 * @param {{id: string, password_hash: string}} user - користувач з БД.
 * @returns {string} підписаний JWT.
 */
export function signPasswordResetToken(user) {
  return jwt.sign({ sub: user.id, purpose: RESET_PURPOSE }, getJwtSecret() + user.password_hash, {
    algorithm: ALGORITHM,
    expiresIn: config.jwt.passwordResetExpiresIn,
  });
}

/**
 * Читає ідентифікатор користувача з токена відновлення БЕЗ перевірки підпису —
 * лише щоб знайти користувача, чий хеш пароля потрібен для перевірки.
 * @param {string} token - токен відновлення з посилання.
 * @returns {string|null} значення `sub` або null, якщо токен неможливо розібрати.
 */
export function readTokenSubject(token) {
  const payload = jwt.decode(token);
  return payload && typeof payload.sub === 'string' ? payload.sub : null;
}

/**
 * Перевіряє підпис, строк дії та призначення токена відновлення пароля.
 * @param {string} token - токен відновлення з посилання.
 * @param {string} passwordHash - поточний хеш пароля користувача.
 * @returns {{sub: string, purpose: string}} корисне навантаження токена.
 * @throws {import('jsonwebtoken').JsonWebTokenError} якщо токен недійсний, прострочений
 *   або не є токеном відновлення.
 */
export function verifyPasswordResetToken(token, passwordHash) {
  const payload = jwt.verify(token, getJwtSecret() + passwordHash, { algorithms: [ALGORITHM] });
  if (payload.purpose !== RESET_PURPOSE) {
    throw new jwt.JsonWebTokenError('Токен не призначений для відновлення пароля');
  }
  return payload;
}
