/**
 * @module modules/playlists/playlists.controller
 * @description HTTP-обробники Playlist Service: читають перевірені дані запиту й ідентифікатор
 * користувача з токена (`req.user.id`), викликають playlists.service і формують JSON-відповідь.
 */

import * as playlistService from './playlists.service.js';

/**
 * GET /api/playlists — плейлисти поточного користувача.
 * @param {import('express').Request} req - HTTP-запит авторизованого користувача;
 *   query: необов'язковий `trackId`.
 * @param {import('express').Response} res - 200 `{playlists}`; з `trackId` кожен плейлист
 *   містить `hasTrack`.
 * @returns {Promise<void>}
 */
export async function listPlaylists(req, res) {
  res.json({ playlists: await playlistService.listPlaylists(req.user.id, req.query.trackId) });
}

/**
 * POST /api/playlists — створення плейлиста (UC-4).
 * @param {import('express').Request} req - тіло: `{title}`.
 * @param {import('express').Response} res - 201 `{playlist}`.
 * @returns {Promise<void>}
 */
export async function createPlaylist(req, res) {
  const playlist = await playlistService.createPlaylist(req.user.id, req.body.title);
  res.status(201).json({ playlist });
}

/**
 * POST /api/playlists/with-track — новий плейлист з першим треком (BPMN рис. 1.4).
 * @param {import('express').Request} req - тіло: `{title, trackId}`.
 * @param {import('express').Response} res - 201 `{playlist, track}`.
 * @returns {Promise<void>}
 */
export async function createPlaylistWithTrack(req, res) {
  const { title, trackId } = req.body;
  res.status(201).json(await playlistService.createPlaylistWithTrack(req.user.id, title, trackId));
}

/**
 * GET /api/playlists/:id — плейлист разом з треками.
 * @param {import('express').Request} req - params: `id`.
 * @param {import('express').Response} res - 200 `{playlist, tracks}`.
 * @returns {Promise<void>}
 */
export async function getPlaylist(req, res) {
  res.json(await playlistService.getPlaylist(req.user.id, req.params.id));
}

/**
 * PATCH /api/playlists/:id — перейменування плейлиста (UC-11).
 * @param {import('express').Request} req - params: `id`; тіло: `{title}`.
 * @param {import('express').Response} res - 200 `{playlist}`.
 * @returns {Promise<void>}
 */
export async function renamePlaylist(req, res) {
  const playlist = await playlistService.renamePlaylist(req.user.id, req.params.id, req.body.title);
  res.json({ playlist });
}

/**
 * DELETE /api/playlists/:id — видалення плейлиста (UC-11).
 * @param {import('express').Request} req - params: `id`.
 * @param {import('express').Response} res - 204 без тіла.
 * @returns {Promise<void>}
 */
export async function deletePlaylist(req, res) {
  await playlistService.deletePlaylist(req.user.id, req.params.id);
  res.status(204).end();
}

/**
 * POST /api/playlists/:id/tracks — додавання треку до плейлиста (UC-4).
 * @param {import('express').Request} req - params: `id`; тіло: `{trackId}`.
 * @param {import('express').Response} res - 201 `{track}` (з датою додавання `added_at`).
 * @returns {Promise<void>}
 */
export async function addTrack(req, res) {
  const track = await playlistService.addTrack(req.user.id, req.params.id, req.body.trackId);
  res.status(201).json({ track });
}

/**
 * DELETE /api/playlists/:id/tracks/:trackId — вилучення треку з плейлиста (UC-11).
 * @param {import('express').Request} req - params: `id`, `trackId`.
 * @param {import('express').Response} res - 204 без тіла.
 * @returns {Promise<void>}
 */
export async function removeTrack(req, res) {
  await playlistService.removeTrack(req.user.id, req.params.id, req.params.trackId);
  res.status(204).end();
}

/**
 * GET /api/favorites/ids — ідентифікатори улюблених треків.
 * @param {import('express').Request} req - HTTP-запит авторизованого користувача.
 * @param {import('express').Response} res - 200 `{ids}`.
 * @returns {Promise<void>}
 */
export async function listFavoriteIds(req, res) {
  res.json({ ids: await playlistService.listFavoriteIds(req.user.id) });
}

/**
 * POST /api/favorites/:trackId — додати трек до «Улюблених».
 * @param {import('express').Request} req - params: `trackId`.
 * @param {import('express').Response} res - 201 `{track}`.
 * @returns {Promise<void>}
 */
export async function addFavorite(req, res) {
  const track = await playlistService.addFavorite(req.user.id, req.params.trackId);
  res.status(201).json({ track });
}

/**
 * DELETE /api/favorites/:trackId — прибрати трек з «Улюблених».
 * @param {import('express').Request} req - params: `trackId`.
 * @param {import('express').Response} res - 204 без тіла.
 * @returns {Promise<void>}
 */
export async function removeFavorite(req, res) {
  await playlistService.removeFavorite(req.user.id, req.params.trackId);
  res.status(204).end();
}
