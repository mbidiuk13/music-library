/**
 * @module modules/recommendations/recommendation.repository
 * @description SQL-запити Recommendation Engine до таблиць track і user_listen_history.
 * Усі запити параметризовані (`$1, $2, …`). Метадані треків щоразу читаються з БД
 * (без кешу векторів), тож правки адміністратора одразу враховуються рекомендаціями.
 */

import { query } from '../../db/pool.js';

/** Поля треку, які бачать усі користувачі (без s3_key). */
const PUBLIC_COLUMNS = 'id, title, artist, genre, bpm, key_signature, mood, year, play_count';

/**
 * Топ треків за кількістю відтворень (резервна гілка і блок «Популярне»).
 * @param {number} limit - максимальна кількість треків (POPULAR_LIMIT = 100).
 * @returns {Promise<object[]>} треки (без s3_key), популярніші — першими.
 */
export async function findPopularTracks(limit) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM track
     ORDER BY play_count DESC, title, id
     LIMIT $1`,
    [limit],
  );
  return rows;
}

/**
 * Унікальні ідентифікатори треків з історії прослуховувань користувача.
 * @param {string} userId - UUID користувача.
 * @returns {Promise<string[]>} UUID прослуханих треків без повторів (k = довжина масиву).
 */
export async function findListenedTrackIds(userId) {
  const { rows } = await query(
    'SELECT DISTINCT track_id FROM user_listen_history WHERE user_id = $1',
    [userId],
  );
  return rows.map((row) => row.track_id);
}

/**
 * Метадані всіх треків медіатеки (для векторизації й пошуку bpm/year min-max).
 * @returns {Promise<object[]>} усі треки (без s3_key).
 */
export async function findAllTracks() {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM track`);
  return rows;
}
