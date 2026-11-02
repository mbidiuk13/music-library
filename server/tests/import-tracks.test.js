/**
 * @file Тести скрипту `npm run import:tracks`. Звернення до AWS S3 підмінено: «бакет» —
 * це множина ключів у пам'яті, яку поповнює підмінений uploadFile. Аудіофайли — тимчасовий
 * каталог із мінімальним вмістом. Перевірка читання ключів з БД — на тестовій БД (TEST_DATABASE_URL).
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jest } from '@jest/globals';
import { closePool, query } from '../src/db/pool.js';
import s3 from '../src/services/s3.js';
import { importTracks, listTrackKeys, printSummary } from '../scripts/import-tracks.js';
import { describeDb } from './helpers/db.js';
import { MP3_BYTES, insertTestTrack } from './helpers/media.js';

let mediaDir;
/** Ключі, які «вже є» в підміненому бакеті. */
let bucket;
let uploadFile;
let fileExists;

/**
 * Створює у тимчасовому каталозі файли з заданими іменами.
 * @param {...string} names - імена файлів.
 * @returns {Promise<void>}
 */
async function addMediaFiles(...names) {
  await Promise.all(names.map((name) => writeFile(join(mediaDir, name), MP3_BYTES)));
}

/**
 * Запускає імпорт для заданих ключів без виводу в консоль.
 * @param {string[]} keys - ключі S3, які «повертає БД».
 * @returns {Promise<import('../scripts/import-tracks.js').ImportSummary>} підсумок.
 */
function runImport(keys) {
  return importTracks({ mediaDir, listKeys: async () => keys, log: () => {} });
}

beforeEach(async () => {
  mediaDir = await mkdtemp(join(tmpdir(), 'music-media-'));
  bucket = new Set();
  fileExists = jest.spyOn(s3, 'fileExists').mockImplementation(async (key) => bucket.has(key));
  uploadFile = jest.spyOn(s3, 'uploadFile').mockImplementation(async ({ key }) => {
    bucket.add(key);
  });
});

afterEach(async () => {
  jest.restoreAllMocks();
  await rm(mediaDir, { recursive: true, force: true });
});

describe('scripts/import-tracks: importTracks', () => {
  test('завантажує файл з mediaDir під ключем s3_key з ContentType audio/mpeg', async () => {
    await addMediaFiles('lisa_sawadika.mp3');

    const summary = await runImport(['tracks/lisa_sawadika.mp3']);

    expect(summary).toEqual({ uploaded: ['tracks/lisa_sawadika.mp3'], skipped: [], missing: [] });
    expect(uploadFile).toHaveBeenCalledTimes(1);
    const [{ key, body, contentType }] = uploadFile.mock.calls[0];
    expect(key).toBe('tracks/lisa_sawadika.mp3');
    expect(contentType).toBe('audio/mpeg');
    expect(body.equals(MP3_BYTES)).toBe(true);
  });

  test('пропускає ключі, які вже є в бакеті, навіть без локального файлу', async () => {
    await addMediaFiles('a.mp3');
    bucket.add('tracks/a.mp3').add('tracks/admin-upload.mp3');

    const summary = await runImport(['tracks/a.mp3', 'tracks/admin-upload.mp3']);

    expect(summary).toEqual({
      uploaded: [],
      skipped: ['tracks/a.mp3', 'tracks/admin-upload.mp3'],
      missing: [],
    });
    expect(uploadFile).not.toHaveBeenCalled();
  });

  test('відсутні файли потрапляють у missing, а решта завантажується', async () => {
    await addMediaFiles('a.mp3', 'c.mp3');

    const summary = await runImport(['tracks/a.mp3', 'tracks/b.mp3', 'tracks/c.mp3']);

    expect(summary).toEqual({
      uploaded: ['tracks/a.mp3', 'tracks/c.mp3'],
      skipped: [],
      missing: ['tracks/b.mp3'],
    });
  });

  test('повторний запуск нічого не завантажує вдруге', async () => {
    await addMediaFiles('a.mp3', 'b.mp3');
    const keys = ['tracks/a.mp3', 'tracks/b.mp3', 'tracks/absent.mp3'];

    await runImport(keys);
    uploadFile.mockClear();
    const second = await runImport(keys);

    expect(uploadFile).not.toHaveBeenCalled();
    expect(second).toEqual({
      uploaded: [],
      skipped: ['tracks/a.mp3', 'tracks/b.mp3'],
      missing: ['tracks/absent.mp3'],
    });
  });

  test('бере з ключа лише ім’я файлу — шлях не виходить за межі mediaDir', async () => {
    await addMediaFiles('x.mp3');

    const summary = await runImport(['tracks/../../x.mp3']);

    expect(summary.uploaded).toEqual(['tracks/../../x.mp3']);
    expect(uploadFile.mock.calls[0][0].body.equals(MP3_BYTES)).toBe(true);
  });

  test('помилка S3 зупиняє імпорт і містить ключ файлу', async () => {
    await addMediaFiles('a.mp3', 'b.mp3');
    uploadFile.mockRejectedValueOnce(new Error('Access Denied'));

    await expect(runImport(['tracks/a.mp3', 'tracks/b.mp3'])).rejects.toThrow(
      'не вдалося завантажити tracks/a.mp3: Access Denied',
    );
    expect(uploadFile).toHaveBeenCalledTimes(1);
  });

  test('помилка перевірки бакета (напр. 403) передається далі', async () => {
    await addMediaFiles('a.mp3');
    fileExists.mockRejectedValueOnce(new Error('Forbidden'));

    await expect(runImport(['tracks/a.mp3'])).rejects.toThrow('Forbidden');
    expect(uploadFile).not.toHaveBeenCalled();
  });
});

describe('scripts/import-tracks: printSummary', () => {
  test('виводить кількості й перелік відсутніх файлів', () => {
    const lines = [];

    printSummary(
      {
        uploaded: ['tracks/a.mp3'],
        skipped: ['tracks/b.mp3', 'tracks/c.mp3'],
        missing: ['tracks/d.mp3'],
      },
      (line) => lines.push(line),
    );

    expect(lines).toEqual([
      '',
      'Завантажено в S3: 1',
      'Пропущено (уже є в бакеті): 2',
      'Бракує файлів у server/media/: 1',
      '  - d.mp3 (tracks/d.mp3)',
    ]);
  });
});

describeDb('scripts/import-tracks: робота з БД', () => {
  afterAll(() => closePool());

  test('listTrackKeys повертає s3_key треків без повторів', async () => {
    const track = await insertTestTrack();
    await insertTestTrack({ s3_key: track.s3_key });

    const keys = await listTrackKeys();

    expect(keys.filter((key) => key === track.s3_key)).toEqual([track.s3_key]);
  });

  test('імпорт не змінює записи треків у БД', async () => {
    const track = await insertTestTrack({ play_count: 7 });
    bucket.add(track.s3_key);

    await importTracks({ mediaDir, log: () => {} });

    const { rows } = await query('SELECT * FROM track WHERE id = $1', [track.id]);
    expect(rows).toEqual([track]);
  });
});
