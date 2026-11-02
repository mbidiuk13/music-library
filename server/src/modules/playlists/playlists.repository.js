/**
 * @module modules/playlists/playlists.repository
 * @description SQL-запити Playlist Service до таблиць playlist і playlist_track.
 * Усі запити параметризовані (`$1, $2, …`). Кожен запит до конкретного плейлиста містить умову
 * `user_id = $…`, тож користувач не може прочитати чи змінити чужий плейлист. Функції з параметром
 * `db` можуть виконуватися як окремо (через пул), так і в межах транзакції (через її `client`).
 */

import { pool, query } from '../../db/pool.js';

/** Поля треку в складі плейлиста (без s3_key). */
const TRACK_COLUMNS =
  't.id, t.title, t.artist, t.genre, t.bpm, t.key_signature, t.mood, t.year, t.play_count';

/** Поля плейлиста разом із кількістю треків (потрібне GROUP BY p.id). */
const PLAYLIST_COLUMNS = 'p.id, p.title, p.created_at, COUNT(pt.track_id)::int AS track_count';

/**
 * Повертає плейлисти користувача з кількістю треків в кожному.
 * Системний плейлист (з назвою favoritesTitle) — першим, решта — в порядку створення.
 * @param {string} userId - UUID власника.
 * @param {string} favoritesTitle - назва плейлиста «Улюблені».
 * @returns {Promise<Array<{id: string, title: string, created_at: Date, track_count: number}>>} плейлисти.
 */
export async function listPlaylists(userId, favoritesTitle) {
  const { rows } = await query(
    `SELECT ${PLAYLIST_COLUMNS}
     FROM playlist p
     LEFT JOIN playlist_track pt ON pt.playlist_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id
     ORDER BY p.title = $2 DESC, p.created_at, p.title`,
    [userId, favoritesTitle],
  );
  return rows;
}

/**
 * Шукає плейлист, що належить користувачу.
 * @param {string} id - UUID плейлиста.
 * @param {string} userId - UUID користувача, який робить запит.
 * @returns {Promise<{id: string, title: string, created_at: Date, track_count: number}|undefined>}
 *   плейлист або undefined, якщо його немає чи він належить іншому користувачу.
 */
export async function findPlaylist(id, userId) {
  const { rows } = await query(
    `SELECT ${PLAYLIST_COLUMNS}
     FROM playlist p
     LEFT JOIN playlist_track pt ON pt.playlist_id = p.id
     WHERE p.id = $1 AND p.user_id = $2
     GROUP BY p.id`,
    [id, userId],
  );
  return rows[0];
}

/**
 * Створює плейлист.
 * @param {string} userId - UUID власника.
 * @param {string} title - назва (уже перевірена й обрізана).
 * @param {import('pg').Pool|import('pg').PoolClient} [db=pool] - пул або з'єднання транзакції.
 * @returns {Promise<{id: string, title: string, created_at: Date}>} створений плейлист.
 * @throws {Error} помилка PostgreSQL 23505, якщо в користувача вже є плейлист з такою назвою;
 *   23503, якщо користувача не існує.
 */
export async function insertPlaylist(userId, title, db = pool) {
  const { rows } = await db.query(
    'INSERT INTO playlist (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at',
    [userId, title],
  );
  return rows[0];
}

/**
 * Перейменовує плейлист користувача.
 * @param {string} id - UUID плейлиста.
 * @param {string} userId - UUID власника.
 * @param {string} title - нова назва (уже перевірена й обрізана).
 * @returns {Promise<{id: string, title: string, created_at: Date}|undefined>} оновлений плейлист
 *   або undefined, якщо плейлиста немає чи він чужий.
 * @throws {Error} помилка PostgreSQL 23505, якщо в користувача вже є плейлист з такою назвою.
 */
export async function renamePlaylist(id, userId, title) {
  const { rows } = await query(
    `UPDATE playlist SET title = $3
     WHERE id = $1 AND user_id = $2
     RETURNING id, title, created_at`,
    [id, userId, title],
  );
  return rows[0];
}

/**
 * Видаляє плейлист користувача; його записи в playlist_track видаляються каскадно
 * (ON DELETE CASCADE), самі треки лишаються в медіатеці.
 * @param {string} id - UUID плейлиста.
 * @param {string} userId - UUID власника.
 * @returns {Promise<boolean>} true, якщо плейлист видалено; false, якщо його немає чи він чужий.
 */
export async function deletePlaylist(id, userId) {
  const { rowCount } = await query('DELETE FROM playlist WHERE id = $1 AND user_id = $2', [
    id,
    userId,
  ]);
  return rowCount > 0;
}

/**
 * Повертає треки плейлиста в порядку додавання.
 * @param {string} playlistId - UUID плейлиста (належність користувачу перевіряє сервіс).
 * @returns {Promise<object[]>} публічні дані треків із датою додавання `added_at`.
 */
export async function listPlaylistTracks(playlistId) {
  const { rows } = await query(
    `SELECT ${TRACK_COLUMNS}, pt.added_at
     FROM playlist_track pt
     JOIN track t ON t.id = pt.track_id
     WHERE pt.playlist_id = $1
     ORDER BY pt.added_at, t.title, t.id`,
    [playlistId],
  );
  return rows;
}

/**
 * Додає трек до плейлиста і повертає дані цього треку.
 * @param {string} playlistId - UUID плейлиста (належність користувачу перевіряє сервіс).
 * @param {string} trackId - UUID треку.
 * @param {import('pg').Pool|import('pg').PoolClient} [db=pool] - пул або з'єднання транзакції.
 * @returns {Promise<object>} публічні дані доданого треку з датою додавання `added_at`.
 * @throws {Error} помилка PostgreSQL 23505, якщо трек уже є в плейлисті (PRIMARY KEY
 *   (playlist_id, track_id)); 23503, якщо треку або плейлиста не існує.
 */
export async function insertPlaylistTrack(playlistId, trackId, db = pool) {
  const { rows } = await db.query(
    `WITH added AS (
       INSERT INTO playlist_track (playlist_id, track_id) VALUES ($1, $2)
       RETURNING track_id, added_at
     )
     SELECT ${TRACK_COLUMNS}, added.added_at
     FROM added
     JOIN track t ON t.id = added.track_id`,
    [playlistId, trackId],
  );
  return rows[0];
}

/**
 * Прибирає трек з плейлиста (сам трек лишається в медіатеці).
 * @param {string} playlistId - UUID плейлиста (належність користувачу перевіряє сервіс).
 * @param {string} trackId - UUID треку.
 * @returns {Promise<boolean>} true, якщо трек прибрано; false, якщо його не було в плейлисті.
 */
export async function deletePlaylistTrack(playlistId, trackId) {
  const { rowCount } = await query(
    'DELETE FROM playlist_track WHERE playlist_id = $1 AND track_id = $2',
    [playlistId, trackId],
  );
  return rowCount > 0;
}

/**
 * Шукає плейлист користувача за точною назвою (використовується для «Улюблених»).
 * @param {string} userId - UUID власника.
 * @param {string} title - назва плейлиста.
 * @returns {Promise<string|undefined>} UUID плейлиста або undefined.
 */
export async function findPlaylistIdByTitle(userId, title) {
  const { rows } = await query('SELECT id FROM playlist WHERE user_id = $1 AND title = $2', [
    userId,
    title,
  ]);
  return rows[0]?.id;
}

/**
 * Повертає ідентифікатори треків плейлиста користувача з указаною назвою.
 * @param {string} userId - UUID власника.
 * @param {string} title - назва плейлиста.
 * @returns {Promise<string[]>} UUID треків у порядку додавання (порожній масив, якщо плейлиста немає).
 */
export async function listTrackIdsByPlaylistTitle(userId, title) {
  const { rows } = await query(
    `SELECT pt.track_id
     FROM playlist_track pt
     JOIN playlist p ON p.id = pt.playlist_id
     WHERE p.user_id = $1 AND p.title = $2
     ORDER BY pt.added_at, pt.track_id`,
    [userId, title],
  );
  return rows.map((row) => row.track_id);
}
