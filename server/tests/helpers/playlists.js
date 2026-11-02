/**
 * @file Допоміжні функції для тестів Playlist Service: користувач із плейлистом «Улюблені»
 * (як після реєстрації) і прямий доступ до таблиць playlist і playlist_track.
 */

import config from '../../src/config/index.js';
import { query } from '../../src/db/pool.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import { uniqueEmail } from './db.js';

/**
 * Створює користувача з плейлистом «Улюблені» безпосередньо в тестовій БД (без bcrypt)
 * і токен доступу для нього.
 * @returns {Promise<{id: string, favoritesId: string, auth: string}>} ідентифікатори
 *   користувача і його «Улюблених», значення заголовка Authorization.
 */
export async function createUser() {
  const email = uniqueEmail('playlists');
  const { rows } = await query(
    `INSERT INTO users (email, username, password_hash) VALUES ($1, 'Слухач', 'x') RETURNING id`,
    [email],
  );
  const { id } = rows[0];
  const favorites = await query(
    'INSERT INTO playlist (user_id, title) VALUES ($1, $2) RETURNING id',
    [id, config.favoritesTitle],
  );
  const token = signAccessToken({ id, role: 'user', email });
  return { id, favoritesId: favorites.rows[0].id, auth: `Bearer ${token}` };
}

/**
 * Повертає плейлисти користувача прямо з БД (для перевірки, що запит нічого не змінив).
 * @param {string} userId - UUID користувача.
 * @returns {Promise<Array<{id: string, title: string}>>} плейлисти в порядку назв.
 */
export async function playlistsInDb(userId) {
  const { rows } = await query('SELECT id, title FROM playlist WHERE user_id = $1 ORDER BY title', [
    userId,
  ]);
  return rows;
}

/**
 * Повертає ідентифікатори треків плейлиста прямо з БД.
 * @param {string} playlistId - UUID плейлиста.
 * @returns {Promise<string[]>} UUID треків.
 */
export async function trackIdsInDb(playlistId) {
  const { rows } = await query(
    'SELECT track_id FROM playlist_track WHERE playlist_id = $1 ORDER BY added_at',
    [playlistId],
  );
  return rows.map((row) => row.track_id);
}
