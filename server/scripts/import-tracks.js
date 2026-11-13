//завантажує mp3 з server/media/ у S3 під ключами s3_key треків із БД; наявні в бакеті пропускає
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../src/db/pool.js';
import { runDbScript } from '../src/db/sqlFile.js';
import s3 from '../src/services/s3.js';

export const MEDIA_DIR = fileURLToPath(new URL('../media/', import.meta.url));

const CONTENT_TYPE = 'audio/mpeg';

export async function listTrackKeys() {
  const { rows } = await query('SELECT DISTINCT s3_key FROM track ORDER BY s3_key');
  return rows.map((row) => row.s3_key);
}

//береться лише ім'я файлу з ключа, тож шлях не може вийти за межі mediaDir
async function readMediaFile(mediaDir, key) {
  try {
    return await readFile(resolve(mediaDir, basename(key)));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

//бакет перевіряється першим, тож треки, додані через адмін-панель, пропускаються й без локального файлу
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

export function printSummary({ uploaded, skipped, missing }, log = console.log) {
  log('');
  log(`Завантажено в S3: ${uploaded.length}`);
  log(`Пропущено (уже є в бакеті): ${skipped.length}`);
  log(`Бракує файлів у server/media/: ${missing.length}`);
  for (const key of missing) log(`  - ${basename(key)} (${key})`);
}

async function main() {
  const summary = await importTracks();
  printSummary(summary);
}

//під час імпорту модуля в тестах скрипт не запускається — лише через `node scripts/import-tracks.js`
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runDbScript(main);
}
