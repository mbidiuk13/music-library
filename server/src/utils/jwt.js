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
