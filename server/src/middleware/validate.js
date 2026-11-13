import { validationResult } from 'express-validator';
import AppError from '../utils/AppError.js';

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
