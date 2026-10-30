/**
 * @module modules/auth/auth.controller
 * @description HTTP-обробники Auth Controller: читають перевірені дані запиту,
 * викликають auth.service і формують JSON-відповідь.
 */

import * as authService from './auth.service.js';

/**
 * POST /api/auth/register — реєстрація нового користувача (UC-1).
 * @param {import('express').Request} req - тіло: `{email, username, password, passwordConfirm, acceptTerms}`.
 * @param {import('express').Response} res - 201 `{token, user}`.
 * @returns {Promise<void>}
 */
export async function register(req, res) {
  const { email, username, password } = req.body;
  const result = await authService.register({ email, username, password });
  res.status(201).json(result);
}

/**
 * POST /api/auth/login — вхід до системи (UC-2).
 * @param {import('express').Request} req - тіло: `{email, password}`.
 * @param {import('express').Response} res - 200 `{token, user}`.
 * @returns {Promise<void>}
 */
export async function login(req, res) {
  const { email, password } = req.body;
  res.json(await authService.login({ email, password }));
}

/**
 * GET /api/auth/me — дані поточного користувача.
 * @param {import('express').Request} req - запит з `req.user` (після authenticate).
 * @param {import('express').Response} res - 200 `{user}`.
 * @returns {Promise<void>}
 */
export async function me(req, res) {
  res.json({ user: await authService.getCurrentUser(req.user.id) });
}

/**
 * POST /api/auth/forgot-password — запит на відновлення пароля.
 * Відповідь однакова незалежно від того, чи зареєстровано email.
 * @param {import('express').Request} req - тіло: `{email}`.
 * @param {import('express').Response} res - 200 `{message}`.
 * @returns {Promise<void>}
 */
export async function forgotPassword(req, res) {
  await authService.requestPasswordReset(req.body.email);
  res.json({
    message:
      'Якщо обліковий запис з такою поштою існує, ми надіслали на неї посилання для відновлення пароля',
  });
}

/**
 * POST /api/auth/reset-password — встановлення нового пароля за посиланням з листа.
 * @param {import('express').Request} req - тіло: `{token, password, passwordConfirm}`.
 * @param {import('express').Response} res - 200 `{message}`.
 * @returns {Promise<void>}
 */
export async function resetPassword(req, res) {
  const { token, password } = req.body;
  await authService.resetPassword({ token, password });
  res.json({ message: 'Пароль змінено. Увійдіть з новим паролем' });
}
