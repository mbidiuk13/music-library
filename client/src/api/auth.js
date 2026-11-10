/**
 * @module api/auth
 * @description Звернення до Auth Controller (`/api/auth`).
 */

import { request } from './client.js';

/**
 * Вхід до системи (UC-2).
 * @param {{email: string, password: string}} credentials - пошта і пароль.
 * @returns {Promise<{token: string, user: object}>} токен доступу і дані користувача.
 */
export function login(credentials) {
  return request('/auth/login', { method: 'POST', body: credentials });
}

/**
 * Реєстрація нового користувача (UC-1).
 * @param {{email: string, username: string, password: string, passwordConfirm: string}} data -
 *   дані форми реєстрації.
 * @returns {Promise<{token: string, user: object}>} токен доступу і дані користувача.
 */
export function register(data) {
  return request('/auth/register', { method: 'POST', body: data });
}

/**
 * Дані поточного користувача за збереженим токеном (відновлення сесії).
 * @param {AbortSignal} [signal] - сигнал для скасування запиту.
 * @returns {Promise<{user: object}>} дані користувача.
 */
export function fetchMe(signal) {
  return request('/auth/me', { signal });
}

/**
 * Запит на відновлення пароля: сервер надсилає лист із посиланням.
 * @param {string} email - пошта користувача.
 * @returns {Promise<{message: string}>} повідомлення сервера.
 */
export function forgotPassword(email) {
  return request('/auth/forgot-password', { method: 'POST', body: { email } });
}

/**
 * Перевірка посилання для відновлення пароля перед показом форми (дані не змінюються).
 * @param {string} token - токен з посилання в листі.
 * @param {AbortSignal} [signal] - сигнал для скасування запиту.
 * @returns {Promise<null>} null, якщо посилання дійсне (відповідь 204).
 * @throws {import('./client.js').ApiError} INVALID_RESET_TOKEN, якщо посилання недійсне.
 */
export function verifyResetToken(token, signal) {
  return request('/auth/reset-password/verify', { method: 'POST', body: { token }, signal });
}

/**
 * Встановлення нового пароля за токеном з листа.
 * @param {{token: string, password: string, passwordConfirm: string}} data - токен і новий пароль.
 * @returns {Promise<{message: string}>} повідомлення сервера.
 */
export function resetPassword(data) {
  return request('/auth/reset-password', { method: 'POST', body: data });
}
