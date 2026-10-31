/**
 * @module modules/media/media.repository
 * @description SQL-запити Media Service до таблиць track і user_listen_history.
 * Усі запити параметризовані (`$1, $2, …`); текст пошукового запиту користувача
 * потрапляє в SQL лише як значення параметра. Функції, що приймають `client`,
 * виконуються в межах транзакції (див. db/pool.transaction).
 */

import { query } from '../../db/pool.js';

/** Поля треку, які бачать усі користувачі (без s3_key). */
const PUBLIC_COLUMNS = 'id, title, artist, genre, bpm, key_signature, mood, year, play_count';

/** Поля треку для адмін-панелі та внутрішньої роботи сервісу. */
const ADMIN_COLUMNS = `${PUBLIC_COLUMNS}, s3_key, created_at`;

/**
 * Екранує спецсимволи шаблону LIKE (`\`, `%`, `_`), щоб вони шукалися як звичайні символи.
 * @param {string} text - текст пошукового запиту.
 * @returns {string} текст, безпечний для вставлення в шаблон ILIKE.
 */
export function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

/**
 * Шукає трек за ідентифікатором.
 * @param {string} id - UUID треку.
 * @returns {Promise<object|undefined>} рядок таблиці track (разом з s3_key) або undefined.
 */
export async function findTrackById(id) {
  const { rows } = await query(`SELECT ${ADMIN_COLUMNS} FROM track WHERE id = $1`, [id]);
  return rows[0];
}

/**
 * Пошук треків (FR-4): підрядок `q` у назві, виконавці або жанрі (ILIKE, використовує
 * trigram-індекси) та/або точний фільтр за жанром. Популярніші треки — першими.
 * @param {{q?: string, genre?: string, limit: number, offset: number}} params - умови пошуку і пагінація.
 * @returns {Promise<{tracks: object[], total: number}>} треки сторінки (без s3_key) і загальна кількість знайдених.
 */
export async function searchTracks({ q, genre, limit, offset }) {
  const pattern = q ? `%${escapeLike(q)}%` : null;
  const where = `WHERE ($1::text IS NULL
      OR title ILIKE $1 ESCAPE '\\' OR artist ILIKE $1 ESCAPE '\\' OR genre ILIKE $1 ESCAPE '\\')
    AND ($2::text IS NULL OR genre = $2)`;

  const [list, count] = await Promise.all([
    query(
      `SELECT ${PUBLIC_COLUMNS} FROM track ${where}
       ORDER BY play_count DESC, title, id
       LIMIT $3 OFFSET $4`,
      [pattern, genre ?? null, limit, offset],
    ),
    query(`SELECT COUNT(*)::int AS total FROM track ${where}`, [pattern, genre ?? null]),
  ]);
  return { tracks: list.rows, total: count.rows[0].total };
}

/**
 * Повертає сторінку списку треків для адмін-панелі (новіші — першими).
 * Пошук: за початком ідентифікатора (у таблиці показуються перші 8 символів UUID) або підрядком назви.
 * @param {{q?: string, limit: number, offset: number}} params - пошуковий запит і пагінація.
 * @returns {Promise<{tracks: object[], total: number}>} треки сторінки й загальна кількість знайдених.
 */
export async function listTracksForAdmin({ q, limit, offset }) {
  const titlePattern = q ? `%${escapeLike(q)}%` : null;
  const idPattern = q ? `${escapeLike(q)}%` : null;
  const where = `WHERE $1::text IS NULL OR title ILIKE $1 ESCAPE '\\' OR id::text ILIKE $2 ESCAPE '\\'`;

  const [list, count] = await Promise.all([
    query(
      `SELECT ${ADMIN_COLUMNS} FROM track ${where}
       ORDER BY created_at DESC, id
       LIMIT $3 OFFSET $4`,
      [titlePattern, idPattern, limit, offset],
    ),
    query(`SELECT COUNT(*)::int AS total FROM track ${where}`, [titlePattern, idPattern]),
  ]);
  return { tracks: list.rows, total: count.rows[0].total };
}

/**
 * Додає трек до медіатеки.
 * @param {{id: string, title: string, artist: string, genre: string, bpm: number,
 *   key_signature: string, mood: string, year: number, s3_key: string}} track - дані треку.
 * @returns {Promise<object>} створений рядок таблиці track.
 * @throws {Error} помилка PostgreSQL (порушення обмежень, збій з'єднання).
 */
export async function insertTrack(track) {
  const { rows } = await query(
    `INSERT INTO track (id, title, artist, genre, bpm, key_signature, mood, year, s3_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${ADMIN_COLUMNS}`,
    [
      track.id,
      track.title,
      track.artist,
      track.genre,
      track.bpm,
      track.key_signature,
      track.mood,
      track.year,
      track.s3_key,
    ],
  );
  return rows[0];
}

/**
 * Оновлює метадані треку (модерація, UC-6). Аудіофайл і лічильник відтворень не змінюються.
 * @param {string} id - UUID треку.
 * @param {{title: string, artist: string, genre: string, bpm: number,
 *   key_signature: string, mood: string, year: number}} metadata - нові метадані.
 * @returns {Promise<object|undefined>} оновлений рядок або undefined, якщо треку немає.
 */
export async function updateTrack(id, metadata) {
  const { rows } = await query(
    `UPDATE track
     SET title = $2, artist = $3, genre = $4, bpm = $5, key_signature = $6, mood = $7, year = $8
     WHERE id = $1
     RETURNING ${ADMIN_COLUMNS}`,
    [
      id,
      metadata.title,
      metadata.artist,
      metadata.genre,
      metadata.bpm,
      metadata.key_signature,
      metadata.mood,
      metadata.year,
    ],
  );
  return rows[0];
}

/**
 * Видаляє трек; записи в playlist_track і user_listen_history видаляються каскадно (ON DELETE CASCADE).
 * @param {import('pg').PoolClient} client - з'єднання транзакції.
 * @param {string} id - UUID треку.
 * @returns {Promise<string|undefined>} ключ аудіофайлу в S3 або undefined, якщо треку немає.
 */
export async function deleteTrack(client, id) {
  const { rows } = await client.query('DELETE FROM track WHERE id = $1 RETURNING s3_key', [id]);
  return rows[0]?.s3_key;
}
