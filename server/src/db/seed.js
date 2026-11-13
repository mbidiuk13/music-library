import { query, transaction } from './pool.js';
import { readSqlFile, runDbScript } from './sqlFile.js';

//якщо треки вже є, нічого не робить, щоб повторний запуск не створив дублікатів
async function seed() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM track');
  if (rows[0].count > 0) {
    console.log(`У таблиці track уже є ${rows[0].count} треків — seed пропущено`);
    return;
  }

  const seedSql = await readSqlFile('seed.sql');
  await transaction((client) => client.query(seedSql));

  const { rows: after } = await query('SELECT COUNT(*)::int AS count FROM track');
  console.log(`Додано треків: ${after[0].count} (database/seed.sql)`);
}

await runDbScript(seed);
