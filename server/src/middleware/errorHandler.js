import AppError from '../utils/AppError.js';
import config from '../config/index.js';

export function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Ресурс не знайдено'));
}

//неочікувані помилки логуються, а клієнт отримує лише загальне повідомлення
//eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { code: err.code, message: err.message };
    if (err.details) body.details = err.details;
    res.status(err.status).json({ error: body });
    return;
  }

  //помилки body-parser
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
