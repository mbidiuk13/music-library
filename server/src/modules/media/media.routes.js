/**
 * @module modules/media/media.routes
 * @description Маршрути Media Service і серверні правила валідації. Адміністративні маршрути
 * (`/api/admin/tracks`) підключаються в app.js після перевірок authenticate і requireRole('admin').
 * Ті самі правила валідації метаданих дублюються на клієнті (форма адмін-панелі).
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { BPM_RANGE, GENRES, KEYS, MOODS, getYearRange } from '../../config/vocabularies.js';
import { optionalAuth } from '../../middleware/auth.js';
import uploadAudio from '../../middleware/upload.js';
import validate from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './media.controller.js';

/** Максимальна довжина назви й виконавця (як у схемі БД). */
const TEXT_MAX = 255;

/** Максимальна довжина пошукового запиту. */
const QUERY_MAX = 100;

/** Розмір сторінки списків за замовчуванням і максимальний. */
const PAGE_LIMIT = Object.freeze({ default: 20, max: 100 });

/**
 * Правило для обов'язкового текстового поля (рядок 1–255 символів після trim).
 * @param {string} field - назва поля.
 * @param {string} emptyMessage - повідомлення, якщо поле порожнє.
 * @param {string} tooLongMessage - повідомлення, якщо текст задовгий.
 * @returns {import('express-validator').ValidationChain} ланцюжок перевірок.
 */
const requiredText = (field, emptyMessage, tooLongMessage) =>
  body(field)
    .isString()
    .withMessage(emptyMessage)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(emptyMessage)
    .bail()
    .isLength({ max: TEXT_MAX })
    .withMessage(tooLongMessage);

/**
 * Правило для поля зі словника (значення обирається зі списку, а не вводиться текстом).
 * @param {string} field - назва поля.
 * @param {readonly string[]} values - допустимі значення.
 * @param {string} message - повідомлення про помилку.
 * @returns {import('express-validator').ValidationChain} ланцюжок перевірок.
 */
const oneOf = (field, values, message) =>
  body(field).isString().withMessage(message).bail().isIn(values).withMessage(message);

/**
 * Правило для цілого числа в діапазоні. Значення з форми (рядок) перетворюється на число.
 * @param {string} field - назва поля.
 * @param {() => {min: number, max: number}} getRange - межі діапазону (обчислюються під час запиту).
 * @param {(range: {min: number, max: number}) => string} formatMessage - текст помилки.
 * @returns {import('express-validator').ValidationChain} ланцюжок перевірок.
 */
const integerInRange = (field, getRange, formatMessage) => {
  const message = () => formatMessage(getRange());
  return body(field)
    .not()
    .isArray()
    .withMessage(message)
    .bail()
    .isInt()
    .withMessage(message)
    .bail()
    .toInt()
    .custom((value) => {
      const { min, max } = getRange();
      return value >= min && value <= max;
    })
    .withMessage(message);
};

/** Правила для 7 полів метаданих треку (створення і редагування). */
const trackMetadataRules = [
  requiredText('title', 'Введіть назву треку', `Назва не може бути довшою за ${TEXT_MAX} символів`),
  requiredText(
    'artist',
    'Введіть виконавця',
    `Ім'я виконавця не може бути довшим за ${TEXT_MAX} символів`,
  ),
  oneOf('genre', GENRES, 'Оберіть жанр зі списку'),
  oneOf('key_signature', KEYS, 'Оберіть тональність зі списку'),
  oneOf('mood', MOODS, 'Оберіть настрій зі списку'),
  integerInRange(
    'bpm',
    () => BPM_RANGE,
    ({ min, max }) => `Темп має бути цілим числом від ${min} до ${max} BPM`,
  ),
  integerInRange(
    'year',
    () => getYearRange(),
    ({ min, max }) => `Рік має бути цілим числом від ${min} до ${max}`,
  ),
];

/** Правило для ідентифікатора треку в шляху запиту. */
const trackIdRule = param('id').isUUID().withMessage('Некоректний ідентифікатор треку');

/**
 * Правило для необов'язкового пошукового запиту `q`.
 * @returns {import('express-validator').ValidationChain} ланцюжок перевірок.
 */
const searchTextRule = () =>
  query('q')
    .optional()
    .isString()
    .withMessage('Некоректний пошуковий запит')
    .bail()
    .trim()
    .isLength({ max: QUERY_MAX })
    .withMessage(`Пошуковий запит не може бути довшим за ${QUERY_MAX} символів`);

/** Правила пагінації: `limit` (1–100, за замовчуванням 20) і `offset` (≥ 0, за замовчуванням 0). */
const paginationRules = [
  query('limit')
    .default(PAGE_LIMIT.default)
    .isInt({ min: 1, max: PAGE_LIMIT.max })
    .withMessage(`Параметр limit має бути цілим числом від 1 до ${PAGE_LIMIT.max}`)
    .bail()
    .toInt(),
  query('offset')
    .default(0)
    .isInt({ min: 0 })
    .withMessage("Параметр offset має бути цілим невід'ємним числом")
    .bail()
    .toInt(),
];

/** Публічні маршрути треків: `/api/tracks`. */
export const trackRouter = Router();

/**
 * Пошук за назвою, виконавцем або жанром (`q`) та/або точний фільтр `genre`.
 * @route GET /api/tracks/search
 */
trackRouter.get(
  '/search',
  searchTextRule(),
  query('genre')
    .optional()
    .isString()
    .withMessage('Оберіть жанр зі списку')
    .bail()
    .isIn(GENRES)
    .withMessage('Оберіть жанр зі списку'),
  query('q')
    .custom((value, { req }) => Boolean(value) || Boolean(req.query.genre))
    .withMessage('Введіть пошуковий запит або оберіть жанр'),
  paginationRules,
  validate,
  asyncHandler(controller.searchTracks),
);

/**
 * Метадані треку.
 * @route GET /api/tracks/:id
 */
trackRouter.get('/:id', trackIdRule, validate, asyncHandler(controller.getTrack));

/**
 * Pre-signed URL для відтворення.
 * @route GET /api/tracks/:id/stream
 */
trackRouter.get('/:id/stream', trackIdRule, validate, asyncHandler(controller.getStreamUrl));

/**
 * Облік відтворення: лічильник і (для авторизованого) історія прослуховувань.
 * @route POST /api/tracks/:id/play
 */
trackRouter.post(
  '/:id/play',
  optionalAuth,
  trackIdRule,
  validate,
  asyncHandler(controller.registerPlay),
);

/** Довідкові маршрути: `/api/meta`. */
export const metaRouter = Router();

/**
 * Словники жанрів, настроїв і тональностей.
 * @route GET /api/meta/vocabularies
 */
metaRouter.get('/vocabularies', controller.getVocabularies);

/** Маршрути адміністратора: `/api/admin/tracks`. */
export const adminTrackRouter = Router();

/**
 * Список треків для адмін-панелі (пошук за ID або назвою).
 * @route GET /api/admin/tracks
 */
adminTrackRouter.get(
  '/',
  searchTextRule(),
  paginationRules,
  validate,
  asyncHandler(controller.listTracksForAdmin),
);

/**
 * Завантаження аудіо з метаданими (UC-9).
 * @route POST /api/admin/tracks
 */
adminTrackRouter.post(
  '/',
  uploadAudio,
  body('file')
    .custom((value, { req }) => Boolean(req.file))
    .withMessage('Оберіть аудіофайл у форматі MP3 або WAV'),
  trackMetadataRules,
  validate,
  asyncHandler(controller.createTrack),
);

/**
 * Модерація метаданих треку (UC-6).
 * @route PUT /api/admin/tracks/:id
 */
adminTrackRouter.put(
  '/:id',
  trackIdRule,
  trackMetadataRules,
  validate,
  asyncHandler(controller.updateTrack),
);

/**
 * Видалення треку разом з аудіофайлом у S3.
 * @route DELETE /api/admin/tracks/:id
 */
adminTrackRouter.delete('/:id', trackIdRule, validate, asyncHandler(controller.deleteTrack));
