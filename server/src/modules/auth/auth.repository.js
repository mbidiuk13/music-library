/**
 * @module modules/auth/auth.repository
 * @description SQL-запити Auth Controller до таблиць users і playlist.
 * Усі запити параметризовані (`$1, $2, …`). Функції, що приймають `client`,
 * виконуються в межах транзакції (див. db/pool.transaction).
 */

import { query } from '../../db/pool.js';

/** Поля користувача, які можна повертати клієнту (без password_hash). */
const PUBLIC_COLUMNS = 'id, email, username, role, created_at';

/**
 * Шукає користувача за email (разом із хешем пароля — для перевірки входу).
 * @param {string} email - email у нижньому регістрі.
 * @returns {Promise<object|undefined>} рядок таблиці users або undefined.
 */
export async function findUserByEmail(email) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = $1`,
    [email],
  );
  return rows[0];
}

/**
 * Шукає користувача за ідентифікатором.
 * @param {string} id - UUID користувача.
 * @returns {Promise<object|undefined>} рядок таблиці users (з password_hash) або undefined.
 */
export async function findUserById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE id = $1`, [
    id,
  ]);
  return rows[0];
}

/**
 * Додає нового користувача з роллю `user`.
 * @param {import('pg').PoolClient} client - з'єднання транзакції.
 * @param {{email: string, username: string, passwordHash: string}} data - дані користувача.
 * @returns {Promise<object>} створений користувач (без password_hash).
 * @throws {Error} помилка PostgreSQL 23505, якщо email уже зайнято.
 */
export async function insertUser(client, { email, username, passwordHash }) {
  const { rows } = await client.query(
    `INSERT INTO users (email, username, password_hash)
     VALUES ($1, $2, $3)
     RETURNING ${PUBLIC_COLUMNS}`,
    [email, username, passwordHash],
  );
  return rows[0];
}

/**
 * Створює плейлист користувача (під час реєстрації — системний плейлист «Улюблені»).
 * @param {import('pg').PoolClient} client - з'єднання транзакції.
 * @param {string} userId - UUID власника.
 * @param {string} title - назва плейлиста.
 * @returns {Promise<void>}
 */
export async function insertPlaylist(client, userId, title) {
  await client.query('INSERT INTO playlist (user_id, title) VALUES ($1, $2)', [userId, title]);
}
