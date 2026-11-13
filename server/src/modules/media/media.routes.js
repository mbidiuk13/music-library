import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { BPM_RANGE, GENRES, KEYS, MOODS, getYearRange } from '../../config/vocabularies.js';
import { optionalAuth } from '../../middleware/auth.js';
import uploadAudio from '../../middleware/upload.js';
import validate from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './media.controller.js';

const TEXT_MAX = 255;

const QUERY_MAX = 100;

const PAGE_LIMIT = Object.freeze({ default: 20, max: 100 });

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

const oneOf = (field, values, message) =>
  body(field).isString().withMessage(message).bail().isIn(values).withMessage(message);

//межі беруться з getRange під час кожної перевірки, а не фіксуються під час старту сервера
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

const trackIdRule = param('id').isUUID().withMessage('Некоректний ідентифікатор треку');

const searchTextRule = () =>
  query('q')
    .optional()
    .isString()
    .withMessage('Некоректний пошуковий запит')
    .bail()
    .trim()
    .isLength({ max: QUERY_MAX })
    .withMessage(`Пошуковий запит не може бути довшим за ${QUERY_MAX} символів`);

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

export const trackRouter = Router();

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

trackRouter.get('/:id', trackIdRule, validate, asyncHandler(controller.getTrack));

trackRouter.get('/:id/stream', trackIdRule, validate, asyncHandler(controller.getStreamUrl));

//доступно й гостям; для авторизованого ще й пишеться історія прослуховувань
trackRouter.post(
  '/:id/play',
  optionalAuth,
  trackIdRule,
  validate,
  asyncHandler(controller.registerPlay),
);

export const metaRouter = Router();

metaRouter.get('/vocabularies', controller.getVocabularies);

//доступ перевіряється в app.js: authenticate і requireRole('admin')
export const adminTrackRouter = Router();

adminTrackRouter.get(
  '/',
  searchTextRule(),
  paginationRules,
  validate,
  asyncHandler(controller.listTracksForAdmin),
);

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

adminTrackRouter.put(
  '/:id',
  trackIdRule,
  trackMetadataRules,
  validate,
  asyncHandler(controller.updateTrack),
);

adminTrackRouter.delete('/:id', trackIdRule, validate, asyncHandler(controller.deleteTrack));
