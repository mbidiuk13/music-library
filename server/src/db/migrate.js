/**
 * @module db/migrate
 * @description Скрипт `npm run migrate`: створює схему БД з database/schema.sql —
 * 5 таблиць (users, track, playlist, playlist_track, user_listen_history), обмеження й індекси —
 * однією транзакцією. `npm run migrate:reset` спершу видаляє ці таблиці разом з усіма даними
 * (лише для розробки; у production заборонено).
 */

import config from '../config/index.js';
import { transaction } from './pool.js';
import { readSqlFile, runDbScript } from './sqlFile.js';

/** Таблиці схеми в порядку, безпечному для видалення (спершу залежні). */
const TABLES = ['user_listen_history', 'playlist_track', 'playlist', 'track', 'users'];

/** Код помилки PostgreSQL «таблиця вже існує» (duplicate_table). */
const DUPLICATE_TABLE = '42P07';

/**
 * Створює схему БД; з `reset` — попередньо видаляє наявні таблиці.
 * @param {{reset: boolean}} options - параметри запуску.
 * @returns {Promise<void>}
 * @throws {Error} якщо схема вже існує (без reset) або reset запущено в production.
 */
async function migrate({ reset }) {
  if (reset && config.isProduction) {
    throw new Error('migrate:reset видаляє всі дані й заборонений при NODE_ENV=production');
  }

  const schemaSql = await readSqlFile('schema.sql');

  try {
    await transaction(async (client) => {
      if (reset) {
        await client.query(`DROP TABLE IF EXISTS ${TABLES.join(', ')} CASCADE`);
        console.log(`Видалено таблиці: ${TABLES.join(', ')}`);
      }
      await client.query(schemaSql);
    });
  } catch (err) {
    if (err.code === DUPLICATE_TABLE) {
      throw new Error(
        'схема вже існує. Щоб створити її заново (усі дані буде видалено): npm run migrate:reset',
      );
    }
    throw err;
  }

  console.log('Схему БД створено: 5 таблиць, обмеження та індекси (database/schema.sql)');
}

await runDbScript(() => migrate({ reset: process.argv.includes('--reset') }));
