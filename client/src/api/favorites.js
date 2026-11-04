/**
 * @module api/favorites
 * @description Шорткати плейлиста «Улюблені» (`/api/favorites`) для кнопки-сердечка.
 */

import { request } from './client.js';

/**
 * Ідентифікатори улюблених треків поточного користувача.
 * @param {AbortSignal} [signal] - сигнал для скасування запиту.
 * @returns {Promise<{ids: string[]}>} масив UUID треків.
 */
export function fetchFavoriteIds(signal) {
  return request('/favorites/ids', { signal });
}

/**
 * Додає трек до «Улюблених».
 * @param {string} trackId - UUID треку.
 * @returns {Promise<any>} відповідь сервера.
 */
export function addFavorite(trackId) {
  return request(`/favorites/${encodeURIComponent(trackId)}`, { method: 'POST' });
}

/**
 * Прибирає трек з «Улюблених».
 * @param {string} trackId - UUID треку.
 * @returns {Promise<any>} відповідь сервера.
 */
export function removeFavorite(trackId) {
  return request(`/favorites/${encodeURIComponent(trackId)}`, { method: 'DELETE' });
}
