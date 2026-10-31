/**
 * @file Інтеграційні тести адміністративних маршрутів Media Service (`/api/admin/tracks`):
 * завантаження аудіо (UC-9), модерація метаданих (UC-6), видалення треку, список для адмін-панелі.
 * Звернення до AWS S3 підмінено, БД — окрема тестова (TEST_DATABASE_URL).
 */

import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import request from 'supertest';
import createApp from '../src/app.js';
import { closePool, pool, query } from '../src/db/pool.js';
import s3 from '../src/services/s3.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { describeDb } from './helpers/db.js';
import { MP3_BYTES, WAV_BYTES, insertTestTrack, trackMetadata } from './helpers/media.js';

const app = createApp();
const adminToken = signAccessToken({
  id: randomUUID(),
  role: 'admin',
  email: 'admin@test.local',
});
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/**
 * Готує запит на завантаження треку від імені адміністратора.
 * @param {object} [metadata] - поля форми (за замовчуванням — коректні метадані).
 * @returns {import('supertest').Test} запит POST /api/admin/tracks без файлу.
 */
function uploadRequest(metadata = trackMetadata()) {
  const req = request(app).post('/api/admin/tracks').set('Authorization', `Bearer ${adminToken}`);
  for (const [field, value] of Object.entries(metadata)) req.field(field, String(value));
  return req;
}

/**
 * Повертає повідомлення про помилку для поля з відповіді 400.
 * @param {import('supertest').Response} res - відповідь сервера.
 * @param {string} field - назва поля.
 * @returns {string|undefined} повідомлення або undefined.
 */
function fieldError(res, field) {
  return res.body.error.details?.find((detail) => detail.field === field)?.message;
}

/**
 * Перевіряє, чи є трек у БД.
 * @param {string} id - UUID треку.
 * @returns {Promise<boolean>} true, якщо запис існує.
 */
async function trackExists(id) {
  const { rows } = await query('SELECT 1 FROM track WHERE id = $1', [id]);
  return rows.length === 1;
}

let uploadFile;
let deleteFile;

beforeEach(() => {
  uploadFile = jest.spyOn(s3, 'uploadFile').mockResolvedValue();
  deleteFile = jest.spyOn(s3, 'deleteFile').mockResolvedValue();
});

afterEach(() => jest.restoreAllMocks());
afterAll(() => closePool());

describeDb('POST /api/admin/tracks', () => {
  test('201: файл у S3 під ключем tracks/<id>.mp3, метадані в БД', async () => {
    const res = await uploadRequest().attach('file', MP3_BYTES, {
      filename: 'Song.MP3',
      contentType: 'audio/mpeg',
    });

    expect(res.status).toBe(201);
    const { track } = res.body;
    expect(track).toMatchObject({ ...trackMetadata(), play_count: 0 });
    expect(track.s3_key).toBe(`tracks/${track.id}.mp3`);

    expect(uploadFile).toHaveBeenCalledTimes(1);
    const [upload] = uploadFile.mock.calls[0];
    expect(upload.key).toBe(track.s3_key);
    expect(upload.contentType).toBe('audio/mpeg');
    expect(upload.body.equals(MP3_BYTES)).toBe(true);
    expect(await trackExists(track.id)).toBe(true);
  });

  test('201: WAV зберігається з MIME-типом audio/wav', async () => {
    const res = await uploadRequest().attach('file', WAV_BYTES, {
      filename: 'song.wav',
      contentType: 'audio/x-wav',
    });

    expect(res.status).toBe(201);
    expect(res.body.track.s3_key).toMatch(/\.wav$/);
    expect(uploadFile.mock.calls[0][0].contentType).toBe('audio/wav');
  });

  test.each([
    ['інше розширення', 'song.ogg', 'audio/mpeg', MP3_BYTES],
    ['MIME-тип не аудіо', 'song.mp3', 'text/plain', MP3_BYTES],
    ['розширення і MIME не відповідають одне одному', 'song.mp3', 'audio/wav', MP3_BYTES],
    ['вміст не є аудіо', 'song.mp3', 'audio/mpeg', Buffer.from('<?php echo 1; ?>')],
  ])('415: %s', async (caseName, filename, contentType, bytes) => {
    const res = await uploadRequest().attach('file', bytes, { filename, contentType });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(uploadFile).not.toHaveBeenCalled();
  });

  test('413: файл більший за MAX_UPLOAD_MB', async () => {
    const tooLarge = Buffer.concat([MP3_BYTES, Buffer.alloc(1024 * 1024)]);
    const res = await uploadRequest().attach('file', tooLarge, {
      filename: 'big.mp3',
      contentType: 'audio/mpeg',
    });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    expect(uploadFile).not.toHaveBeenCalled();
  });

  test('400: без файлу', async () => {
    const res = await uploadRequest();

    expect(res.status).toBe(400);
    expect(fieldError(res, 'file')).toBe('Оберіть аудіофайл у форматі MP3 або WAV');
  });

  test.each([
    ['title', { title: '   ' }, 'Введіть назву треку'],
    ['artist', { artist: 'я'.repeat(256) }, "Ім'я виконавця не може бути довшим за 255 символів"],
    ['genre', { genre: 'рок' }, 'Оберіть жанр зі списку'],
    ['key_signature', { key_signature: 'H minor' }, 'Оберіть тональність зі списку'],
    ['mood', { mood: 'Енергійний' }, 'Оберіть настрій зі списку'],
    ['bpm', { bpm: 39 }, 'Темп має бути цілим числом від 40 до 250 BPM'],
    ['bpm', { bpm: '120.5' }, 'Темп має бути цілим числом від 40 до 250 BPM'],
    ['year', { year: 0 }, `Рік має бути цілим числом від 1 до ${new Date().getFullYear() + 1}`],
  ])('400: некоректне поле %s (%j), файл не завантажується', async (field, overrides, message) => {
    const res = await uploadRequest(trackMetadata(overrides)).attach('file', MP3_BYTES, {
      filename: 'song.mp3',
      contentType: 'audio/mpeg',
    });

    expect(res.status).toBe(400);
    expect(fieldError(res, field)).toBe(message);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  test('збій INSERT: файл видаляється з S3 (компенсація), запис не створюється', async () => {
    jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('збій БД'));

    const res = await uploadRequest().attach('file', MP3_BYTES, {
      filename: 'song.mp3',
      contentType: 'audio/mpeg',
    });

    expect(res.status).toBe(500);
    const { key } = uploadFile.mock.calls[0][0];
    expect(deleteFile).toHaveBeenCalledWith(key);
    const id = key.slice('tracks/'.length, -'.mp3'.length);
    expect(await trackExists(id)).toBe(false);
  });

  test('збій S3: 500 STORAGE_ERROR, запис не створюється', async () => {
    uploadFile.mockRejectedValue(new Error('AccessDenied'));
    const title = `Невдале завантаження ${randomUUID()}`;

    const res = await uploadRequest(trackMetadata({ title })).attach('file', MP3_BYTES, {
      filename: 'song.mp3',
      contentType: 'audio/mpeg',
    });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('STORAGE_ERROR');
    const { rows } = await query('SELECT 1 FROM track WHERE title = $1', [title]);
    expect(rows).toHaveLength(0);
  });
});

describeDb('PUT /api/admin/tracks/:id', () => {
  test('200: метадані змінено, файл і лічильник відтворень — без змін', async () => {
    const original = await insertTestTrack({ play_count: 7 });
    const changes = trackMetadata({
      title: '  Нова назва  ',
      genre: 'Джаз',
      mood: 'спокійний',
      bpm: '90',
      year: 1999,
    });

    const res = await request(app)
      .put(`/api/admin/tracks/${original.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(changes);

    expect(res.status).toBe(200);
    expect(res.body.track).toMatchObject({
      id: original.id,
      title: 'Нова назва',
      genre: 'Джаз',
      mood: 'спокійний',
      bpm: 90,
      year: 1999,
      play_count: 7,
      s3_key: original.s3_key,
    });
  });

  test('404: трек не існує', async () => {
    const res = await request(app)
      .put(`/api/admin/tracks/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(trackMetadata());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRACK_NOT_FOUND');
  });

  test('400: некоректний ідентифікатор і неповні метадані', async () => {
    const res = await request(app)
      .put('/api/admin/tracks/not-a-uuid')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Лише назва' });

    expect(res.status).toBe(400);
    expect(fieldError(res, 'id')).toBe('Некоректний ідентифікатор треку');
    expect(fieldError(res, 'genre')).toBe('Оберіть жанр зі списку');
  });

  test('400: масив замість значення не проходить валідацію', async () => {
    const track = await insertTestTrack();
    const res = await request(app)
      .put(`/api/admin/tracks/${track.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(trackMetadata({ genre: ['Поп'], bpm: [120] }));

    expect(res.status).toBe(400);
    expect(fieldError(res, 'genre')).toBe('Оберіть жанр зі списку');
    expect(fieldError(res, 'bpm')).toBe('Темп має бути цілим числом від 40 до 250 BPM');
  });
});

describeDb('DELETE /api/admin/tracks/:id', () => {
  test('204: запис видалено разом з історією прослуховувань і файлом у S3', async () => {
    const track = await insertTestTrack();
    const { rows: users } = await query(
      `INSERT INTO users (email, username, password_hash) VALUES ($1, 'Тест', 'x') RETURNING id`,
      [`del-${randomUUID()}@test.local`],
    );
    await query('INSERT INTO user_listen_history (user_id, track_id) VALUES ($1, $2)', [
      users[0].id,
      track.id,
    ]);

    const res = await request(app)
      .delete(`/api/admin/tracks/${track.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    expect(deleteFile).toHaveBeenCalledWith(track.s3_key);
    expect(await trackExists(track.id)).toBe(false);
    const { rows: history } = await query('SELECT 1 FROM user_listen_history WHERE track_id = $1', [
      track.id,
    ]);
    expect(history).toHaveLength(0);
  });

  test('збій S3: транзакція відкочується, трек лишається', async () => {
    const track = await insertTestTrack();
    deleteFile.mockRejectedValue(new Error('AccessDenied'));

    const res = await request(app)
      .delete(`/api/admin/tracks/${track.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('STORAGE_ERROR');
    expect(await trackExists(track.id)).toBe(true);
  });

  test('404: трек не існує, S3 не викликається', async () => {
    const res = await request(app)
      .delete(`/api/admin/tracks/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(deleteFile).not.toHaveBeenCalled();
  });
});

describeDb('GET /api/admin/tracks', () => {
  const marker = randomUUID();
  let first;
  let second;

  beforeAll(async () => {
    first = await insertTestTrack({ title: `Адмін ${marker} перший` });
    second = await insertTestTrack({ title: `Адмін ${marker} другий` });
  });

  test('пошук за назвою: новіші першими, з s3_key, загальна кількість', async () => {
    const res = await request(app)
      .get('/api/admin/tracks')
      .query({ q: marker })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, limit: 20, offset: 0 });
    expect(res.body.tracks.map((track) => track.id)).toEqual([second.id, first.id]);
    expect(res.body.tracks[0].s3_key).toBe(second.s3_key);
  });

  test('пошук за першими 8 символами ідентифікатора', async () => {
    const res = await request(app)
      .get('/api/admin/tracks')
      .query({ q: first.id.slice(0, 8).toUpperCase() })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tracks.map((track) => track.id)).toContain(first.id);
  });

  test('пагінація і некоректний limit', async () => {
    const page = await request(app)
      .get('/api/admin/tracks')
      .query({ q: marker, limit: 1, offset: 1 })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page.body.tracks.map((track) => track.id)).toEqual([first.id]);
    expect(page.body.total).toBe(2);

    const invalid = await request(app)
      .get('/api/admin/tracks')
      .query({ limit: 1000 })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);
  });
});
