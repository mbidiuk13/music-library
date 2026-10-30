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
