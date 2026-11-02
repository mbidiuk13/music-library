/**
 * @module scripts/import-tracks
 * @description Скрипт `npm run import:tracks`: завантажує аудіофайли з каталогу server/media/
 * у бакет S3 під ключами s3_key треків, які вже є в БД (заповнена з database/seed.sql).
 * Файл шукається за останньою частиною ключа: `tracks/lisa_sawadika.mp3` → `server/media/lisa_sawadika.mp3`.
 * Об'єкти, які вже є в бакеті, повторно не завантажуються, тому скрипт можна запускати кілька разів.
 * Відсутній локальний файл не є помилкою — такі ключі перелічуються в підсумку.
 * БД скрипт лише читає (один запит SELECT).
 */

import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../src/db/pool.js';
import { runDbScript } from '../src/db/sqlFile.js';
import s3 from '../src/services/s3.js';

/** Каталог із локальними mp3 (не потрапляє в git). */
export const MEDIA_DIR = fileURLToPath(new URL('../media/', import.meta.url));

/** MIME-тип, з яким файли зберігаються в S3. */
const CONTENT_TYPE = 'audio/mpeg';

/**
 * Повертає унікальні ключі S3 усіх треків з БД.
 * @returns {Promise<string[]>} значення track.s3_key, відсортовані за абеткою.
 * @throws {Error} якщо схему не створено (спершу npm run migrate) або БД недоступна.
 */
export async function listTrackKeys() {
  const { rows } = await query('SELECT DISTINCT s3_key FROM track ORDER BY s3_key');
  return rows.map((row) => row.s3_key);
}

/**
 * Читає локальний файл треку за ключем S3.
 * Використовується лише ім'я файлу з ключа, тож шлях не може вийти за межі mediaDir.
 * @param {string} mediaDir - каталог з аудіофайлами.
 * @param {string} key - ключ S3, напр. `tracks/<файл>.mp3`.
 * @returns {Promise<Buffer|null>} вміст файлу або null, якщо файлу немає.
 * @throws {Error} інша помилка файлової системи (немає доступу тощо).
 */
async function readMediaFile(mediaDir, key) {
  try {
    return await readFile(resolve(mediaDir, basename(key)));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Підсумок імпорту.
 * @typedef {object} ImportSummary
 * @property {string[]} uploaded - ключі, завантажені в S3 під час цього запуску.
 * @property {string[]} skipped - ключі, які вже були в бакеті.
 * @property {string[]} missing - ключі, для яких немає файлу в mediaDir.
 */

/**
 * Завантажує в S3 файли для всіх ключів треків, яких ще немає в бакеті.
 * Спершу перевіряється бакет, тож треки, завантажені адміністратором через адмін-панель,
 * пропускаються навіть без локального файлу.
 * @param {object} [options] - залежності (у тестах підмінюються).
 * @param {string} [options.mediaDir=MEDIA_DIR] - каталог з аудіофайлами.
 * @param {() => Promise<string[]>} [options.listKeys=listTrackKeys] - джерело ключів S3.
 * @param {(message: string) => void} [options.log=console.log] - вивід перебігу імпорту.
 * @returns {Promise<ImportSummary>} що завантажено, пропущено й чого бракує.
 * @throws {Error} помилка AWS або файлової системи (імпорт зупиняється на цьому файлі).
 */
export async function importTracks({
  mediaDir = MEDIA_DIR,
  listKeys = listTrackKeys,
  log = console.log,
} = {}) {
  const summary = { uploaded: [], skipped: [], missing: [] };

  for (const key of await listKeys()) {
    if (await s3.fileExists(key)) {
      summary.skipped.push(key);
      continue;
    }

    const body = await readMediaFile(mediaDir, key);
    if (!body) {
      summary.missing.push(key);
      continue;
    }

    try {
      await s3.uploadFile({ key, body, contentType: CONTENT_TYPE });
    } catch (err) {
      throw new Error(`не вдалося завантажити ${key}: ${err.message}`, { cause: err });
    }
    summary.uploaded.push(key);
    log(`Завантажено: ${key}`);
  }

  return summary;
}

/**
 * Виводить підсумок імпорту в консоль.
 * @param {ImportSummary} summary - результат importTracks().
 * @param {(message: string) => void} [log=console.log] - функція виводу.
 * @returns {void}
 */
export function printSummary({ uploaded, skipped, missing }, log = console.log) {
  log('');
  log(`Завантажено в S3: ${uploaded.length}`);
  log(`Пропущено (уже є в бакеті): ${skipped.length}`);
  log(`Бракує файлів у server/media/: ${missing.length}`);
  for (const key of missing) log(`  - ${basename(key)} (${key})`);
}

/**
 * Точка входу CLI: імпорт і підсумок.
 * @returns {Promise<void>}
 */
async function main() {
  const summary = await importTracks();
  printSummary(summary);
}

// Під час імпорту модуля в тестах скрипт не запускається — лише через `node scripts/import-tracks.js`.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runDbScript(main);
}
