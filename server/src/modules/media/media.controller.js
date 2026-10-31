/**
 * @module modules/media/media.controller
 * @description HTTP-обробники Media Service: читають перевірені дані запиту,
 * викликають media.service і формують JSON-відповідь.
 */

import { GENRES, KEYS, MOODS } from '../../config/vocabularies.js';
import * as mediaService from './media.service.js';

/**
 * Залишає з тіла запиту лише поля метаданих треку.
 * @param {object} body - перевірене тіло запиту.
 * @returns {{title: string, artist: string, genre: string, bpm: number,
 *   key_signature: string, mood: string, year: number}} метадані треку.
 */
function pickMetadata(body) {
  const { title, artist, genre, bpm, key_signature: keySignature, mood, year } = body;
  return { title, artist, genre, bpm, key_signature: keySignature, mood, year };
}

/**
 * GET /api/tracks/search — пошук треків (UC-3).
 * @param {import('express').Request} req - query: `q`, `genre`, `limit`, `offset`.
 * @param {import('express').Response} res - 200 `{tracks, total, limit, offset}`.
 * @returns {Promise<void>}
 */
export async function searchTracks(req, res) {
  const { q, genre, limit, offset } = req.query;
  res.json(
    await mediaService.searchTracks({
      q: q || undefined,
      genre: genre || undefined,
      limit,
      offset,
    }),
  );
}

/**
 * GET /api/tracks/:id — метадані треку.
 * @param {import('express').Request} req - params: `id`.
 * @param {import('express').Response} res - 200 `{track}`.
 * @returns {Promise<void>}
 */
export async function getTrack(req, res) {
  res.json({ track: await mediaService.getTrack(req.params.id) });
}

/**
 * GET /api/tracks/:id/stream — тимчасове посилання для відтворення (UC-7).
 * @param {import('express').Request} req - params: `id`.
 * @param {import('express').Response} res - 200 `{url, expiresIn}`.
 * @returns {Promise<void>}
 */
export async function getStreamUrl(req, res) {
  res.json(await mediaService.getStreamUrl(req.params.id));
}

/**
 * POST /api/tracks/:id/play — облік відтворення (клієнт викликає, коли трек почав грати).
 * @param {import('express').Request} req - params: `id`; `req.user` — якщо передано дійсний токен.
 * @param {import('express').Response} res - 200 `{id, play_count}`.
 * @returns {Promise<void>}
 */
export async function registerPlay(req, res) {
  res.json(await mediaService.registerPlay(req.params.id, req.user?.id));
}

/**
 * GET /api/meta/vocabularies — словники для випадних списків форми метаданих.
 * @param {import('express').Request} req - HTTP-запит.
 * @param {import('express').Response} res - 200 `{genres, moods, keys}`.
 * @returns {void}
 */
export function getVocabularies(req, res) {
  res.json({ genres: GENRES, moods: MOODS, keys: KEYS });
}

/**
 * GET /api/admin/tracks — список треків для таблиці адмін-панелі.
 * @param {import('express').Request} req - query: `q` (ID або назва), `limit`, `offset`.
 * @param {import('express').Response} res - 200 `{tracks, total, limit, offset}`.
 * @returns {Promise<void>}
 */
export async function listTracksForAdmin(req, res) {
  const { q, limit, offset } = req.query;
  res.json(await mediaService.listTracksForAdmin({ q: q || undefined, limit, offset }));
}

/**
 * POST /api/admin/tracks — завантаження аудіо з метаданими (UC-9).
 * @param {import('express').Request} req - multipart: `file` + 7 полів метаданих.
 * @param {import('express').Response} res - 201 `{track}`.
 * @returns {Promise<void>}
 */
export async function createTrack(req, res) {
  const track = await mediaService.createTrack(pickMetadata(req.body), req.file);
  res.status(201).json({ track });
}

/**
 * PUT /api/admin/tracks/:id — модерація метаданих треку (UC-6).
 * @param {import('express').Request} req - params: `id`; тіло: 7 полів метаданих.
 * @param {import('express').Response} res - 200 `{track}`.
 * @returns {Promise<void>}
 */
export async function updateTrack(req, res) {
  const track = await mediaService.updateTrack(req.params.id, pickMetadata(req.body));
  res.json({ track });
}

/**
 * DELETE /api/admin/tracks/:id — видалення треку разом з аудіофайлом.
 * @param {import('express').Request} req - params: `id`.
 * @param {import('express').Response} res - 204 без тіла.
 * @returns {Promise<void>}
 */
export async function deleteTrack(req, res) {
  await mediaService.deleteTrack(req.params.id);
  res.status(204).end();
}
