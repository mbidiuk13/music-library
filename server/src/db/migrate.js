import config from '../config/index.js';
import { transaction } from './pool.js';
import { readSqlFile, runDbScript } from './sqlFile.js';

//порядок, безпечний для видалення: спершу залежні таблиці
const TABLES = ['user_listen_history', 'playlist_track', 'playlist', 'track', 'users'];

const DUPLICATE_TABLE = '42P07';

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
