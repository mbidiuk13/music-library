/**
 * @module db/sqlFile
 * @description Спільні функції для CLI-скриптів бази даних (migrate, seed, seed:admin):
 * читання SQL-файлів з каталогу database/ і запуск скрипту з коректним завершенням процесу.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { assertDatabaseConfigured, closePool } from './pool.js';

/**
 * Читає SQL-файл з каталогу database/ у корені репозиторію.
 * @param {string} fileName - ім'я файлу, напр. `schema.sql`.
 * @returns {Promise<string>} вміст файлу.
 * @throws {Error} якщо файл не знайдено.
 */
export function readSqlFile(fileName) {
  const path = fileURLToPath(new URL(`../../../database/${fileName}`, import.meta.url));
  return readFile(path, 'utf8');
}

/**
 * Запускає CLI-скрипт бази даних: перевіряє конфігурацію, виконує дії, виводить помилку
 * зрозумілим повідомленням (код завершення 1) і завжди закриває пул з'єднань.
 * @param {() => Promise<void>} main - дії скрипту.
 * @returns {Promise<void>}
 */
export async function runDbScript(main) {
  try {
    assertDatabaseConfigured();
    await main();
  } catch (err) {
    console.error(`Помилка: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
