/**
 * @file Визначення тестової бази даних. Інтеграційні тести працюють лише з окремою БД
 * з TEST_DATABASE_URL (змінна середовища або рядок у .env) і ніколи — з робочою DATABASE_URL,
 * бо перед запуском тестів схема тестової БД створюється заново.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));

/**
 * Читає змінні з кореневого .env, не змінюючи process.env.
 * @returns {Record<string, string>} змінні з .env або порожній об'єкт, якщо файлу немає.
 */
function readDotEnv() {
  return existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
}

/**
 * Повертає рядок підключення до тестової БД.
 * @returns {string} TEST_DATABASE_URL або порожній рядок, якщо тестову БД не налаштовано.
 * @throws {Error} якщо TEST_DATABASE_URL збігається з робочою DATABASE_URL.
 */
export function getTestDatabaseUrl() {
  const dotEnv = readDotEnv();
  const testUrl = process.env.TEST_DATABASE_URL ?? dotEnv.TEST_DATABASE_URL ?? '';
  if (testUrl && testUrl === dotEnv.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL не може збігатися з DATABASE_URL: тести очищають БД');
  }
  return testUrl;
}
