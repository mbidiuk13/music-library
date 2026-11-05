/**
 * @module api/recommendations
 * @description Звернення до Recommendation Engine (`/api/recommendations`).
 */

import { request } from './client.js';

/**
 * Топ-100 треків за кількістю відтворень (блок «Популярне»).
 * @param {AbortSignal} [signal] - сигнал для скасування запиту.
 * @returns {Promise<{tracks: object[]}>} треки, від найпопулярнішого.
 */
export function fetchPopular(signal) {
  return request('/recommendations/popular', { signal });
}

/**
 * Персональні рекомендації авторизованого користувача («Підібрано для вас»).
 * Якщо історія прослуховувань коротша за поріг M, сервер повертає `source: "popular"`.
 * @param {AbortSignal} [signal] - сигнал для скасування запиту.
 * @returns {Promise<{source: 'personal'|'popular', tracks: object[]}>} джерело і треки
 *   (у персональній гілці кожен трек має поле `similarity` ∈ [0; 1]).
 */
export function fetchPersonal(signal) {
  return request('/recommendations/personal', { signal });
}
