/**
 * @module middleware/validate
 * @description Серверна валідація вхідних даних (express-validator). Middleware ставиться
 * після правил перевірки полів і, якщо є порушення, відповідає 400 VALIDATION_ERROR
 * зі списком помилок окремих полів у `details`.
 */

import { validationResult } from 'express-validator';
import AppError from '../utils/AppError.js';

/**
 * Перевіряє результат правил express-validator для поточного запиту.
 * @param {import('express').Request} req - HTTP-запит.
 * @param {import('express').Response} res - HTTP-відповідь.
 * @param {import('express').NextFunction} next - наступний middleware.
 * @returns {void}
 */
export default function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    next();
    return;
  }
  const details = result
    .array({ onlyFirstError: true })
    .map((error) => ({ field: error.path, message: error.msg }));
  next(new AppError(400, 'VALIDATION_ERROR', 'Перевірте правильність заповнення полів', details));
}
