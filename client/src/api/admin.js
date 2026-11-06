/**
 * @module api/admin
 * @description Адміністративні звернення до Media Service (`/api/admin/tracks`, лише роль admin):
 * список треків для адмін-панелі, завантаження аудіо (UC-9), модерація метаданих (UC-6)
 * і видалення треку. Захист — на сервері (requireRole('admin')); не-адмін отримає 403.
 */

import { request } from './client.js';

/**
 * Сторінка списку треків для таблиці адмін-панелі (новіші — першими).
 * @param {{q?: string, limit?: number, offset?: number}} params - пошук за початком ID або назвою, пагінація.
 * @param {AbortSignal} [signal] - сигнал для скасування запиту.
 * @returns {Promise<{tracks: object[], total: number, limit: number, offset: number}>} треки сторінки.
 */
export function fetchAdminTracks({ q, limit, offset }, signal) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));
  return request(`/admin/tracks?${params}`, { signal });
}

/**
 * Завантажує аудіофайл з метаданими (UC-9): файл потрапляє в S3, запис — у таблицю track.
 * @param {FormData} formData - поле `file` (MP3/WAV) і 7 полів метаданих.
 * @returns {Promise<{track: object}>} створений трек.
 * @throws {import('./client.js').ApiError} 413 FILE_TOO_LARGE; 415 UNSUPPORTED_MEDIA_TYPE;
 *   400 VALIDATION_ERROR; 500 STORAGE_ERROR.
 */
export function uploadTrack(formData) {
  return request('/admin/tracks', { method: 'POST', body: formData });
}

/**
 * Оновлює метадані треку (модерація, UC-6).
 * @param {string} id - UUID треку.
 * @param {{title: string, artist: string, genre: string, key_signature: string, mood: string,
 *   bpm: number, year: number}} metadata - усі 7 полів метаданих.
 * @returns {Promise<{track: object}>} оновлений трек.
 * @throws {import('./client.js').ApiError} 400 VALIDATION_ERROR; 404 TRACK_NOT_FOUND.
 */
export function updateTrack(id, metadata) {
  return request(`/admin/tracks/${encodeURIComponent(id)}`, { method: 'PUT', body: metadata });
}

/**
 * Видаляє трек з медіатеки (разом з плейлистами й історією) і його аудіофайл з S3.
 * @param {string} id - UUID треку.
 * @returns {Promise<null>} порожня відповідь (204).
 * @throws {import('./client.js').ApiError} 404 TRACK_NOT_FOUND; 500 STORAGE_ERROR.
 */
export function deleteTrack(id) {
  return request(`/admin/tracks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
