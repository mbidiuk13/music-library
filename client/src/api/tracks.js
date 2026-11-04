/**
 * @module api/tracks
 * @description Звернення до Media Service (`/api/tracks`): посилання для відтворення та облік прослуховувань.
 */

import { request } from './client.js';

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
