//спільні функції CLI-скриптів БД (migrate, seed, seed:admin)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { assertDatabaseConfigured, closePool } from './pool.js';

export function readSqlFile(fileName) {
  const path = fileURLToPath(new URL(`../../../database/${fileName}`, import.meta.url));
  return readFile(path, 'utf8');
}

//пул закривається завжди, інакше процес не завершиться
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
