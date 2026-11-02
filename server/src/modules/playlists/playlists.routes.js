/**
 * @module modules/playlists/playlists.routes
 * @description Маршрути Playlist Service і серверні правила валідації. Усі маршрути — лише для
 * авторизованих користувачів (authenticate). Ті самі правила валідації назви плейлиста
 * дублюються на клієнті (форма «Новий плейлист»).
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './playlists.controller.js';

/** Максимальна довжина назви плейлиста (після обрізання пробілів). */
const TITLE_MAX = 100;

/**
 * Правило для назви плейлиста: рядок 1–100 символів після trim.
 * @returns {import('express-validator').ValidationChain} ланцюжок перевірок.
 */
const titleRule = () =>
  body('title')
    .isString()
    .withMessage('Введіть назву плейлиста')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Введіть назву плейлиста')
    .bail()
    .isLength({ max: TITLE_MAX })
    .withMessage(`Назва плейлиста не може бути довшою за ${TITLE_MAX} символів`);

/** Правило для ідентифікатора плейлиста в шляху запиту. */
const playlistIdRule = param('id').isUUID().withMessage('Некоректний ідентифікатор плейлиста');

/** Маршрути плейлистів: `/api/playlists`. */
export const playlistRouter = Router();

playlistRouter.use(authenticate);

/**
 * Плейлисти поточного користувача з кількістю треків.
 * @route GET /api/playlists
 */
playlistRouter.get('/', asyncHandler(controller.listPlaylists));

/**
 * Створення плейлиста (UC-4).
 * @route POST /api/playlists
 */
playlistRouter.post('/', titleRule(), validate, asyncHandler(controller.createPlaylist));

/**
 * Плейлист разом з треками.
 * @route GET /api/playlists/:id
 */
playlistRouter.get('/:id', playlistIdRule, validate, asyncHandler(controller.getPlaylist));

/**
 * Перейменування плейлиста (UC-11).
 * @route PATCH /api/playlists/:id
 */
playlistRouter.patch(
  '/:id',
  playlistIdRule,
  titleRule(),
  validate,
  asyncHandler(controller.renamePlaylist),
);

/**
 * Видалення плейлиста (UC-11).
 * @route DELETE /api/playlists/:id
 */
playlistRouter.delete('/:id', playlistIdRule, validate, asyncHandler(controller.deletePlaylist));
