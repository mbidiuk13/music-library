/**
 * @file Інтеграційні тести публічних маршрутів Media Service: пошук (UC-3), метадані треку,
 * словники. Працюють з окремою тестовою БД (TEST_DATABASE_URL).
 */

import { randomUUID } from 'node:crypto';
import request from 'supertest';
import createApp from '../src/app.js';
import { GENRES, KEYS, MOODS } from '../src/config/vocabularies.js';
import { closePool } from '../src/db/pool.js';
import { describeDb } from './helpers/db.js';
import { insertTestTrack } from './helpers/media.js';

const app = createApp();
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/** Поля треку в публічних відповідях (без s3_key). */
const PUBLIC_FIELDS = [
  'artist',
  'bpm',
  'genre',
  'id',
  'key_signature',
  'mood',
  'play_count',
  'title',
  'year',
];

/**
 * Виконує пошуковий запит.
 * @param {object} params - query-параметри.
 * @returns {Promise<import('supertest').Response>} відповідь сервера.
 */
function search(params) {
  return request(app).get('/api/tracks/search').query(params);
}

/**
 * Повертає назви знайдених треків у порядку видачі.
 * @param {import('supertest').Response} res - відповідь пошуку.
 * @returns {string[]} назви треків.
 */
function titles(res) {
  return res.body.tracks.map((track) => track.title);
}

afterAll(() => closePool());

describeDb('GET /api/tracks/search', () => {
  // Унікальна мітка відокремлює треки цього файлу від даних інших тестів у спільній БД.
  const marker = randomUUID().slice(0, 8);

  beforeAll(async () => {
    await insertTestTrack({
      title: `Нічний ${marker} рейс`,
      artist: 'Океан',
      genre: 'Рок',
      play_count: 5,
    });
    await insertTestTrack({
      title: `Світанок ${marker}`,
      artist: 'Хор',
      genre: 'Класика',
      play_count: 50,
    });
    await insertTestTrack({
      title: `Вечір ${marker}`,
      artist: `Гурт ${marker.toUpperCase()}`,
      genre: 'Рок',
      play_count: 20,
    });
    await insertTestTrack({ title: `100% ${marker}`, genre: 'Джаз' });
    await insertTestTrack({ title: `100 ${marker}`, genre: 'Джаз' });
  });

  test('підрядок у назві або виконавці без урахування регістру, популярніші першими', async () => {
    const res = await search({ q: marker.toUpperCase() });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(titles(res).slice(0, 3)).toEqual([
      `Світанок ${marker}`,
      `Вечір ${marker}`,
      `Нічний ${marker} рейс`,
    ]);
  });

  test('точний фільтр жанру разом із запитом', async () => {
    const res = await search({ q: marker, genre: 'Рок' });

    expect(res.status).toBe(200);
    expect(titles(res)).toEqual([`Вечір ${marker}`, `Нічний ${marker} рейс`]);
  });

  test('лише жанр, без запиту', async () => {
    const res = await search({ genre: 'Класика', limit: 100 });

    expect(res.status).toBe(200);
    expect(res.body.tracks.every((track) => track.genre === 'Класика')).toBe(true);
    expect(titles(res)).toContain(`Світанок ${marker}`);
  });

  test('запит шукає і в назві жанру', async () => {
    const res = await search({ q: 'класик', limit: 100 });

    expect(titles(res)).toContain(`Світанок ${marker}`);
  });

  test('символи % і _ шукаються буквально', async () => {
    const percent = await search({ q: `% ${marker}` });
    expect(titles(percent)).toEqual([`100% ${marker}`]);

    const underscore = await search({ q: `_${marker}` });
    expect(underscore.body.tracks).toEqual([]);
    expect(underscore.body.total).toBe(0);
  });

  test('у відповіді немає s3_key', async () => {
    const res = await search({ q: marker });

    for (const track of res.body.tracks) {
      expect(Object.keys(track).sort()).toEqual(PUBLIC_FIELDS);
    }
  });

  test('пагінація', async () => {
    const res = await search({ q: marker, limit: 2, offset: 1 });

    expect(res.body).toMatchObject({ total: 5, limit: 2, offset: 1 });
    expect(titles(res)).toEqual([`Вечір ${marker}`, `Нічний ${marker} рейс`]);
  });

  test.each([
    ['порожній запит і без жанру', {}, 'q', 'Введіть пошуковий запит або оберіть жанр'],
    ['запит із пробілів', { q: '   ' }, 'q', 'Введіть пошуковий запит або оберіть жанр'],
    ['жанр не зі словника', { genre: 'рок' }, 'genre', 'Оберіть жанр зі списку'],
    [
      'задовгий запит',
      { q: 'я'.repeat(101) },
      'q',
      'Пошуковий запит не може бути довшим за 100 символів',
    ],
  ])('400: %s', async (caseName, params, field, message) => {
    const res = await search(params);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({ field, message });
  });
});

describeDb('GET /api/tracks/:id', () => {
  test('200: метадані треку без s3_key', async () => {
    const track = await insertTestTrack({ title: 'Окремий трек' });

    const res = await request(app).get(`/api/tracks/${track.id}`);

    expect(res.status).toBe(200);
    expect(res.body.track).toMatchObject({ id: track.id, title: 'Окремий трек' });
    expect(Object.keys(res.body.track).sort()).toEqual(PUBLIC_FIELDS);
  });

  test('404: трек не існує; 400: некоректний ідентифікатор', async () => {
    const missing = await request(app).get(`/api/tracks/${UNKNOWN_ID}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('TRACK_NOT_FOUND');

    const invalid = await request(app).get('/api/tracks/123');
    expect(invalid.status).toBe(400);
  });
});

describe('GET /api/meta/vocabularies', () => {
  test('повертає словники жанрів, настроїв і тональностей', async () => {
    const res = await request(app).get('/api/meta/vocabularies');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ genres: GENRES, moods: MOODS, keys: KEYS });
  });
});
