/**
 * @module modules/playlists/playlists.controller
 * @description HTTP-обробники Playlist Service: читають перевірені дані запиту й ідентифікатор
 * користувача з токена (`req.user.id`), викликають playlists.service і формують JSON-відповідь.
 */

import * as playlistService from './playlists.service.js';

/**
 * GET /api/playlists — плейлисти поточного користувача.
 * @param {import('express').Request} req - HTTP-запит авторизованого користувача.
 * @param {import('express').Response} res - 200 `{playlists}`.
 * @returns {Promise<void>}
 */
export async function listPlaylists(req, res) {
  res.json({ playlists: await playlistService.listPlaylists(req.user.id) });
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
