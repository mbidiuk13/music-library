/**
 * @module api/tracks
 * @description Звернення до Media Service (`/api/tracks`, `/api/meta`): пошук, посилання для
 * відтворення, облік прослуховувань і словники метаданих.
 */

import { request } from './client.js';

/**
 * Пошук треків (UC-3) за назвою, виконавцем чи жанром (`q`) або точний фільтр за жанром (`genre`).
 * Результати впорядковані за кількістю відтворень.
 * @param {{q?: string, genre?: string, limit?: number, offset?: number}} params - параметри пошуку.
 * @param {AbortSignal} [signal] - сигнал для скасування запиту.
 * @returns {Promise<{tracks: object[], total: number, limit: number, offset: number}>} сторінка результатів.
 */
export function searchTracks({ q, genre, limit, offset }, signal) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (genre) params.set('genre', genre);
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));
  return request(`/tracks/search?${params}`, { signal });
}

/**
 * Отримує тимчасове pre-signed посилання S3 на аудіофайл треку (UC-7).
 * Посилання запитується в момент натискання Play, щоб воно не прострочувалось у списках.
 * @param {string} trackId - UUID треку.
 * @returns {Promise<{url: string, expiresIn: number}>} посилання і строк його дії в секундах.
 */
export function getStreamUrl(trackId) {
  return request(`/tracks/${encodeURIComponent(trackId)}/stream`);
}

/**
 * Фіксує відтворення: `play_count + 1`, для авторизованого — запис в історію прослуховувань.
 * Викликається один раз, коли трек реально почав грати.
 * @param {string} trackId - UUID треку.
 * @returns {Promise<{id: string, play_count: number}>} оновлений лічильник.
 */
export function registerPlay(trackId) {
  return request(`/tracks/${encodeURIComponent(trackId)}/play`, { method: 'POST' });
}

/**
 * Словники метаданих: жанри, настрої й тональності (для плиток жанрів і форм адміністратора).
 * @param {AbortSignal} [signal] - сигнал для скасування запиту.
 * @returns {Promise<{genres: string[], moods: string[], keys: string[]}>} словники.
 */
export function fetchVocabularies(signal) {
  return request('/meta/vocabularies', { signal });
}
