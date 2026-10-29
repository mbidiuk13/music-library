/**
 * @module db/pool
 * @description Підключення до PostgreSQL через пул з'єднань node-postgres (pg, без ORM).
 * Усі запити — лише параметризовані (`$1, $2, …`): значення передаються окремо від тексту SQL,
 * що унеможливлює SQL-ін'єкції. Для операцій із кількох запитів є хелпер transaction(fn).
 */

import pg from 'pg';
import config from '../config/index.js';

/**
 * Пул з'єднань з базою даних. Підключення відкриваються ліниво — під час першого запиту.
 * @type {import('pg').Pool}
 */
export const pool = new pg.Pool({ connectionString: config.databaseUrl });

pool.on('error', (err) => {
  console.error("Помилка неактивного з'єднання з PostgreSQL:", err.message);
});

/**
 * Виконує один параметризований SQL-запит на вільному з'єднанні пулу.
 * @param {string} text - текст SQL із плейсхолдерами `$1, $2, …`.
 * @param {Array<unknown>} [params=[]] - значення плейсхолдерів.
 * @returns {Promise<import('pg').QueryResult>} результат запиту (`rows`, `rowCount`, …).
 * @throws {Error} помилка PostgreSQL (порушення обмеження, синтаксис тощо).
 */
export function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Виконує функцію в межах однієї транзакції: BEGIN → fn(client) → COMMIT.
 * Якщо fn кидає помилку, виконується ROLLBACK і помилка передається далі —
 * жодна зі змін, зроблених у транзакції, не зберігається.
 * Усі запити транзакції мають іти через переданий `client`, а не через query().
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn - дії в транзакції.
 * @returns {Promise<T>} значення, яке повернула fn.
 * @throws {Error} помилка з fn або з самої транзакції (після ROLLBACK).
 */
export async function transaction(fn) {
  const client = await pool.connect();
  let brokenConnection;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // Якщо навіть ROLLBACK не вдався, з'єднання несправне — пул його закриє, а не перевикористає.
    await client.query('ROLLBACK').catch((rollbackErr) => {
      brokenConnection = rollbackErr;
    });
    throw err;
  } finally {
    client.release(brokenConnection);
  }
}

/**
 * Закриває всі з'єднання пулу (наприкінці скриптів і тестів).
 * @returns {Promise<void>}
 */
export function closePool() {
  return pool.end();
}
