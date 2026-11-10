/**
 * @module api/playlists
 * @description Звернення до Playlist Service (`/api/playlists`): плейлисти поточного користувача
 * (UC-4, UC-11, FR-9, FR-10). Сервер повертає лише власні плейлисти; чужий — 404.
 */

import { request } from './client.js';

/**
 * Плейлисти поточного користувача з кількістю треків; «Улюблені» — першим.
 * @param {AbortSignal} [signal] - сигнал для скасування запиту.
 * @param {string} [trackId] - UUID треку: якщо передано, кожен плейлист містить ознаку
 *   `hasTrack` — чи вже є в ньому цей трек.
 * @returns {Promise<{playlists: object[]}>} плейлисти `{id, title, created_at, track_count, is_favorites}`
 *   (з `trackId` — ще й `hasTrack`).
 */
export function fetchPlaylists(signal, trackId) {
  const path = trackId ? `/playlists?${new URLSearchParams({ trackId })}` : '/playlists';
  return request(path, { signal });
}

/**
 * Плейлист разом з треками (у порядку додавання).
 * @param {string} id - UUID плейлиста.
 * @param {AbortSignal} [signal] - сигнал для скасування запиту.
 * @returns {Promise<{playlist: object, tracks: object[]}>} плейлист і треки з датою додавання `added_at`.
 */
export function fetchPlaylist(id, signal) {
  return request(`/playlists/${encodeURIComponent(id)}`, { signal });
}

/**
 * Створює порожній плейлист (UC-4).
 * @param {string} title - назва плейлиста.
 * @returns {Promise<{playlist: object}>} створений плейлист.
 * @throws {import('./client.js').ApiError} 409 PLAYLIST_TITLE_TAKEN — назва вже зайнята.
 */
export function createPlaylist(title) {
  return request('/playlists', { method: 'POST', body: { title } });
}

/**
 * Створює плейлист і одразу додає до нього трек — одна транзакція на сервері (BPMN рис. 1.4).
 * @param {string} title - назва нового плейлиста.
 * @param {string} trackId - UUID треку.
 * @returns {Promise<{playlist: object, track: object}>} створений плейлист і доданий трек.
 * @throws {import('./client.js').ApiError} 409 PLAYLIST_TITLE_TAKEN; 404 TRACK_NOT_FOUND.
 */
export function createPlaylistWithTrack(title, trackId) {
  return request('/playlists/with-track', { method: 'POST', body: { title, trackId } });
}

/**
 * Перейменовує плейлист (UC-11). «Улюблені» перейменувати не можна.
 * @param {string} id - UUID плейлиста.
 * @param {string} title - нова назва.
 * @returns {Promise<{playlist: object}>} оновлений плейлист.
 * @throws {import('./client.js').ApiError} 409 PLAYLIST_TITLE_TAKEN; 403 FAVORITES_PROTECTED.
 */
export function renamePlaylist(id, title) {
  return request(`/playlists/${encodeURIComponent(id)}`, { method: 'PATCH', body: { title } });
}

/**
 * Видаляє плейлист (UC-11); треки лишаються в медіатеці. «Улюблені» видалити не можна.
 * @param {string} id - UUID плейлиста.
 * @returns {Promise<null>} порожня відповідь (204).
 * @throws {import('./client.js').ApiError} 403 FAVORITES_PROTECTED; 404 PLAYLIST_NOT_FOUND.
 */
export function deletePlaylist(id) {
  return request(`/playlists/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/**
 * Додає трек до плейлиста (UC-4, FR-10).
 * @param {string} playlistId - UUID плейлиста.
 * @param {string} trackId - UUID треку.
 * @returns {Promise<{track: object}>} доданий трек із датою додавання.
 * @throws {import('./client.js').ApiError} 409 TRACK_ALREADY_IN_PLAYLIST — трек уже є в плейлисті.
 */
export function addTrackToPlaylist(playlistId, trackId) {
  return request(`/playlists/${encodeURIComponent(playlistId)}/tracks`, {
    method: 'POST',
    body: { trackId },
  });
}

/**
 * Вилучає трек з плейлиста (UC-11).
 * @param {string} playlistId - UUID плейлиста.
 * @param {string} trackId - UUID треку.
 * @returns {Promise<null>} порожня відповідь (204).
 * @throws {import('./client.js').ApiError} 404 TRACK_NOT_IN_PLAYLIST.
 */
export function removeTrackFromPlaylist(playlistId, trackId) {
  return request(
    `/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`,
    { method: 'DELETE' },
  );
}
