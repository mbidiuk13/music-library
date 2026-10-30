/**
 * @module middleware/auth
 * @description Автентифікація запитів за JWT із заголовка `Authorization: Bearer <token>`.
 * `authenticate` — для ресурсів лише для авторизованих (🔒), `optionalAuth` — для ресурсів,
 * доступних усім (🌐), де авторизація лише розширює відповідь. Дані користувача з токена
 * записуються в `req.user = { id, role, email }`.
 */

import AppError from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Витягує токен із заголовка Authorization.
 * @param {import('express').Request} req - HTTP-запит.
 * @returns {string|null} токен або null, якщо заголовка немає чи він не у форматі Bearer.
 */
function extractBearerToken(req) {
  const header = req.get('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/**
 * Перевіряє токен і повертає дані користувача з нього.
 * @param {string} token - JWT.
 * @returns {{id: string, role: string, email: string}} користувач для `req.user`.
 * @throws {AppError} 401 INVALID_TOKEN, якщо токен недійсний або прострочений.
 */
function userFromToken(token) {
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AppError(
      401,
      'INVALID_TOKEN',
      'Сесія недійсна або завершилася. Увійдіть до системи знову',
    );
  }
  return { id: payload.sub, role: payload.role, email: payload.email };
}

/**
 * Обов'язкова автентифікація: без дійсного токена запит відхиляється з кодом 401.
 * @param {import('express').Request} req - HTTP-запит.
 * @param {import('express').Response} res - HTTP-відповідь.
 * @param {import('express').NextFunction} next - наступний middleware.
 * @returns {void}
 */
export function authenticate(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Потрібна авторизація'));
    return;
  }
  try {
    req.user = userFromToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Необов'язкова автентифікація: з дійсним токеном заповнює `req.user`, інакше запит
 * обробляється як від гостя (недійсний чи прострочений токен не блокує публічний ресурс).
 * @param {import('express').Request} req - HTTP-запит.
 * @param {import('express').Response} res - HTTP-відповідь.
 * @param {import('express').NextFunction} next - наступний middleware.
 * @returns {void}
 */
export function optionalAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (token) {
    try {
      req.user = userFromToken(token);
    } catch {
      req.user = undefined;
    }
  }
  next();
}
