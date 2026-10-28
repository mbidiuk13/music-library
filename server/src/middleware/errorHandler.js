/**
 * @module middleware/errorHandler
 * @description Централізована обробка помилок і відповідь 404 для невідомих маршрутів API.
 * Формат відповіді: `{ error: { code, message, details? } }`.
 */

import AppError from '../utils/AppError.js';
import config from '../config/index.js';

/**
 * Обробник невідомих маршрутів API: передає далі помилку 404.
 * @param {import('express').Request} req - HTTP-запит.
 * @param {import('express').Response} res - HTTP-відповідь.
 * @param {import('express').NextFunction} next - наступний middleware.
 * @returns {void}
 */
export function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Ресурс не знайдено'));
}

/**
 * Перетворює будь-яку помилку на JSON-відповідь з коректним HTTP-статусом.
 * Внутрішні (неочікувані) помилки логуються, а клієнт отримує загальне повідомлення.
 * @param {Error} err - помилка, передана через next(err) або викинута в обробнику.
 * @param {import('express').Request} req - HTTP-запит.
 * @param {import('express').Response} res - HTTP-відповідь.
 * @param {import('express').NextFunction} next - наступний middleware (потрібен Express для розпізнавання сигнатури).
 * @returns {void}
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { code: err.code, message: err.message };
    if (err.details) body.details = err.details;
    res.status(err.status).json({ error: body });
    return;
  }

  // Некоректний JSON або завелике тіло запиту (помилки body-parser).
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Некоректний формат JSON' } });
    return;
  }
  if (err.type === 'entity.too.large') {
    res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Завеликий розмір запиту' } });
    return;
  }

  if (!config.isTest) console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Внутрішня помилка сервера' } });
}
