/**
 * @module modules/recommendations/recommendation.service
 * @description Бізнес-логіка Recommendation Engine (розділ 3.3.1 ПЗ, рис. 3.4).
 * Персональні рекомендації будуються методом косинусної подібності (content-based filtering):
 *   1) k — кількість унікальних прослуханих треків користувача;
 *   2) якщо k < M (REC_MIN_HISTORY) — резервна гілка: Топ-100 за play_count;
 *   3) інакше всі треки векторизуються (vectorizer.js), обчислюється вектор уподобань
 *      A_user = (1/k) · Σ B_j і подібність sim(A_user, B) для кожного ще не прослуханого треку
 *      (cosine.js); перші N (REC_TOP_N) за спаданням sim — персональна добірка;
 *   4) якщо непрослуханих кандидатів менше за N — список доповнюється популярними треками.
 * Функції chooseSource і rankRecommendations — чисті (без БД), решта читає дані через репозиторій.
 */

import config from '../../config/index.js';
import { cosineSimilarity, preferenceVector } from './cosine.js';
import * as repository from './recommendation.repository.js';
import { getNumericRanges, vectorizeTrack } from './vectorizer.js';

/** Джерело рекомендацій: персональна добірка або резервний Топ популярних. */
export const SOURCE = Object.freeze({ PERSONAL: 'personal', POPULAR: 'popular' });

/**
 * Обирає гілку алгоритму за розміром історії прослуховувань.
 * @param {number} historySize - k, кількість унікальних прослуханих треків.
 * @param {number} minHistory - M, мінімальна кількість прослуханих треків для персональних рекомендацій.
 * @returns {'personal'|'popular'} `popular`, якщо k < M; інакше `personal`.
 */
export function chooseSource(historySize, minHistory) {
  return historySize < minHistory ? SOURCE.POPULAR : SOURCE.PERSONAL;
}

/**
 * Порівнює треки за популярністю: більший play_count — вище; за рівності — за назвою та id
 * (той самий порядок, що й у Топ-100).
 * @param {{play_count: number, title: string, id: string}} a - перший трек.
 * @param {{play_count: number, title: string, id: string}} b - другий трек.
 * @returns {number} від'ємне число, якщо `a` має йти раніше за `b`.
 */
function byPopularity(a, b) {
  return (
    b.play_count - a.play_count || a.title.localeCompare(b.title, 'uk') || (a.id < b.id ? -1 : 1)
  );
}

/**
 * Будує персональну добірку (основна гілка алгоритму) — чиста функція без БД.
 *   B_i = vectorize(track_i),  A_user = (1/k) · Σ_{j ∈ прослухані} B_j,
 *   sim_i = (A_user · B_i) / (‖A_user‖ · ‖B_i‖)  для кожного непрослуханого треку i.
 * Результат — перші topN непрослуханих треків за спаданням sim (за рівності — популярніші).
 * Якщо непрослуханих кандидатів менше за topN, список доповнюється найпопулярнішими треками,
 * яких у ньому ще немає (у таких треків `similarity: null`).
 * @param {object[]} tracks - метадані всіх треків медіатеки.
 * @param {string[]} listenedIds - UUID унікальних прослуханих треків користувача (k ≥ 1).
 * @param {number} topN - N, розмір добірки.
 * @returns {Array<object>} треки з полем `similarity` (число з [0; 1] або null для доповнення).
 */
export function rankRecommendations(tracks, listenedIds, topN) {
  const listened = new Set(listenedIds);
  const ranges = getNumericRanges(tracks);
  const vectors = new Map(tracks.map((track) => [track.id, vectorizeTrack(track, ranges)]));

  const userVector = preferenceVector(
    tracks.filter((track) => listened.has(track.id)).map((track) => vectors.get(track.id)),
  );

  const ranked = tracks
    .filter((track) => !listened.has(track.id))
    .map((track) => ({ ...track, similarity: cosineSimilarity(userVector, vectors.get(track.id)) }))
    .sort((a, b) => b.similarity - a.similarity || byPopularity(a, b))
    .slice(0, topN);

  if (ranked.length < topN) {
    const included = new Set(ranked.map((track) => track.id));
    const filler = tracks
      .filter((track) => !included.has(track.id))
      .sort(byPopularity)
      .slice(0, topN - ranked.length)
      .map((track) => ({ ...track, similarity: null }));
    ranked.push(...filler);
  }
  return ranked;
}

/**
 * Топ-100 треків за кількістю відтворень (блок «Популярне» і резервна гілка).
 * @returns {Promise<object[]>} треки, популярніші — першими.
 */
export function getPopularTracks() {
  return repository.findPopularTracks(config.recommendations.popularLimit);
}

/**
 * Персональні рекомендації для користувача (UC «Отримання рекомендацій»).
 * @param {string} userId - UUID користувача з JWT.
 * @returns {Promise<{source: 'personal'|'popular', tracks: object[]}>} джерело добірки і треки;
 *   у персональній гілці кожен трек має поле `similarity`.
 */
export async function getPersonalRecommendations(userId) {
  const { minHistory, topN } = config.recommendations;
  const listenedIds = await repository.findListenedTrackIds(userId);

  if (chooseSource(listenedIds.length, minHistory) === SOURCE.POPULAR) {
    return { source: SOURCE.POPULAR, tracks: await getPopularTracks() };
  }

  const tracks = await repository.findAllTracks();
  return { source: SOURCE.PERSONAL, tracks: rankRecommendations(tracks, listenedIds, topN) };
}
