/**
 * @file Підготовка тестової БД один раз перед усіма тестами (jest globalSetup):
 * створює базу, якщо її ще немає, і заново створює схему з database/schema.sql.
 * Без TEST_DATABASE_URL інтеграційні тести з БД пропускаються.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getTestDatabaseUrl } from './testDatabase.js';

/** Код помилки PostgreSQL «бази даних не існує» (invalid_catalog_name). */
const UNKNOWN_DATABASE = '3D000';

/**
 * Створює тестову БД на тому самому сервері PostgreSQL, якщо її ще немає.
 * @param {string} url - рядок підключення до тестової БД.
 * @returns {Promise<void>}
 * @throws {Error} якщо назва БД містить недопустимі символи або немає прав на створення.
 */
async function ensureDatabaseExists(url) {
  const probe = new pg.Client({ connectionString: url });
  try {
    await probe.connect();
    return;
  } catch (err) {
    if (err.code !== UNKNOWN_DATABASE) throw err;
  } finally {
    await probe.end().catch(() => {});
  }

  const dbUrl = new URL(url);
  const name = dbUrl.pathname.slice(1);
  // Назву БД не можна передати параметром запиту, тому дозволено лише безпечні символи.
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Недопустима назва тестової БД: "${name}"`);
  }
  dbUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: dbUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }
}

/**
 * Створює схему тестової БД заново (усі дані попереднього запуску видаляються).
 * @returns {Promise<void>}
 */
export default async function globalSetup() {
  const url = getTestDatabaseUrl();
  if (!url) {
    console.warn('\nTEST_DATABASE_URL не задано — інтеграційні тести з БД буде пропущено.');
    return;
  }

  await ensureDatabaseExists(url);

  const schemaPath = fileURLToPath(new URL('../../../database/schema.sql', import.meta.url));
  const schemaSql = await readFile(schemaPath, 'utf8');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await client.query(schemaSql);
  } finally {
    await client.end();
  }
}
