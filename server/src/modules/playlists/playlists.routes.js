import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './playlists.controller.js';

const TITLE_MAX = 100;

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

const playlistIdRule = param('id').isUUID().withMessage('Некоректний ідентифікатор плейлиста');

const TRACK_ID_MESSAGE = 'Некоректний ідентифікатор треку';

const trackIdBodyRule = () =>
  body('trackId')
    .isString()
    .withMessage(TRACK_ID_MESSAGE)
    .bail()
    .isUUID()
    .withMessage(TRACK_ID_MESSAGE);

const trackIdParamRule = param('trackId').isUUID().withMessage(TRACK_ID_MESSAGE);

//лише один рядок-UUID: повторений параметр ?trackId= (масив) відхиляється
const trackIdQueryRule = query('trackId')
  .optional()
  .custom((value) => typeof value === 'string')
  .withMessage(TRACK_ID_MESSAGE)
  .bail()
  .isUUID()
  .withMessage(TRACK_ID_MESSAGE);

export const playlistRouter = Router();

playlistRouter.use(authenticate);

playlistRouter.get('/', trackIdQueryRule, validate, asyncHandler(controller.listPlaylists));

playlistRouter.post('/', titleRule(), validate, asyncHandler(controller.createPlaylist));

playlistRouter.post(
  '/with-track',
  titleRule(),
  trackIdBodyRule(),
  validate,
  asyncHandler(controller.createPlaylistWithTrack),
);

playlistRouter.get('/:id', playlistIdRule, validate, asyncHandler(controller.getPlaylist));

playlistRouter.patch(
  '/:id',
  playlistIdRule,
  titleRule(),
  validate,
  asyncHandler(controller.renamePlaylist),
);

playlistRouter.delete('/:id', playlistIdRule, validate, asyncHandler(controller.deletePlaylist));

playlistRouter.post(
  '/:id/tracks',
  playlistIdRule,
  trackIdBodyRule(),
  validate,
  asyncHandler(controller.addTrack),
);

playlistRouter.delete(
  '/:id/tracks/:trackId',
  playlistIdRule,
  trackIdParamRule,
  validate,
  asyncHandler(controller.removeTrack),
);

//шорткати для «сердечка»: працюють з плейлистом «Улюблені»
export const favoritesRouter = Router();

favoritesRouter.use(authenticate);

favoritesRouter.get('/ids', asyncHandler(controller.listFavoriteIds));

favoritesRouter.post('/:trackId', trackIdParamRule, validate, asyncHandler(controller.addFavorite));

favoritesRouter.delete(
  '/:trackId',
  trackIdParamRule,
  validate,
  asyncHandler(controller.removeFavorite),
);
