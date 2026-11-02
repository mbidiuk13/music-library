/**
 * @file Інтеграційні тести Playlist Service (UC-4, UC-11, FR-9, FR-10): створення, перегляд,
 * перейменування й видалення плейлистів, захист «Улюблених», доступ лише до власних плейлистів.
 * Працюють з окремою тестовою БД (TEST_DATABASE_URL).
 */

import request from 'supertest';
import createApp from '../src/app.js';
import { closePool, query } from '../src/db/pool.js';
import { describeDb } from './helpers/db.js';
import { createUser, playlistsInDb } from './helpers/playlists.js';

const app = createApp();
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/**
 * Створює плейлист через API.
 * @param {{auth: string}} user - користувач.
 * @param {string} title - назва.
 * @returns {Promise<object>} створений плейлист з відповіді.
 */
async function createPlaylist(user, title) {
  const res = await request(app)
    .post('/api/playlists')
    .set('Authorization', user.auth)
    .send({ title });
  expect(res.status).toBe(201);
  return res.body.playlist;
}

afterAll(() => closePool());

describe('Playlist Service без токена', () => {
  test.each([
    ['get', '/api/playlists'],
    ['post', '/api/playlists'],
    ['get', `/api/playlists/${UNKNOWN_ID}`],
  ])('%s %s → 401', async (method, path) => {
    const res = await request(app)[method](path).send({ title: 'Плейлист' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describeDb('GET /api/playlists', () => {
  test('новий користувач бачить лише «Улюблені»', async () => {
    const user = await createUser();

    const res = await request(app).get('/api/playlists').set('Authorization', user.auth);

    expect(res.status).toBe(200);
    expect(res.body.playlists).toEqual([
      {
        id: user.favoritesId,
        title: 'Улюблені',
        created_at: expect.any(String),
        track_count: 0,
        is_favorites: true,
      },
    ]);
  });

  test('«Улюблені» першими, решта — в порядку створення; чужих плейлистів немає', async () => {
    const user = await createUser();
    const other = await createUser();
    await createPlaylist(user, 'Аааа');
    await createPlaylist(user, 'Для бігу');
    await createPlaylist(other, 'Чужий');

    const res = await request(app).get('/api/playlists').set('Authorization', user.auth);

    expect(res.body.playlists.map((p) => p.title)).toEqual(['Улюблені', 'Аааа', 'Для бігу']);
    expect(res.body.playlists.map((p) => p.is_favorites)).toEqual([true, false, false]);
  });
});

describeDb('POST /api/playlists', () => {
  test('201: створює плейлист, назва обрізається', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/playlists')
      .set('Authorization', user.auth)
      .send({ title: '  Вечірній чіл  ' });

    expect(res.status).toBe(201);
    expect(res.body.playlist).toEqual({
      id: expect.any(String),
      title: 'Вечірній чіл',
      created_at: expect.any(String),
      track_count: 0,
      is_favorites: false,
    });
    expect(await playlistsInDb(user.id)).toContainEqual({
      id: res.body.playlist.id,
      title: 'Вечірній чіл',
    });
  });

  test('409: дубль назви в того самого користувача', async () => {
    const user = await createUser();
    await createPlaylist(user, 'Робота');

    const res = await request(app)
      .post('/api/playlists')
      .set('Authorization', user.auth)
      .send({ title: ' Робота ' });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'PLAYLIST_TITLE_TAKEN',
      message: 'Плейлист з такою назвою вже існує',
    });
    expect(await playlistsInDb(user.id)).toHaveLength(2);
  });

  test('409: другий плейлист з назвою «Улюблені» створити не можна', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/playlists')
      .set('Authorization', user.auth)
      .send({ title: 'Улюблені' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLAYLIST_TITLE_TAKEN');
  });

  test('201: інший користувач може мати плейлист з такою самою назвою', async () => {
    const user = await createUser();
    const other = await createUser();
    await createPlaylist(user, 'Спільна назва');

    const res = await request(app)
      .post('/api/playlists')
      .set('Authorization', other.auth)
      .send({ title: 'Спільна назва' });

    expect(res.status).toBe(201);
  });

  test('201: назва рівно зі 100 символів', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/playlists')
      .set('Authorization', user.auth)
      .send({ title: 'я'.repeat(100) });

    expect(res.status).toBe(201);
  });

  test.each([
    ['без назви', {}, 'Введіть назву плейлиста'],
    ['порожня назва', { title: '' }, 'Введіть назву плейлиста'],
    ['лише пробіли', { title: '   ' }, 'Введіть назву плейлиста'],
    ['не рядок', { title: 42 }, 'Введіть назву плейлиста'],
    [
      '101 символ',
      { title: 'я'.repeat(101) },
      'Назва плейлиста не може бути довшою за 100 символів',
    ],
  ])('400: %s', async (name, payload, message) => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/playlists')
      .set('Authorization', user.auth)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([{ field: 'title', message }]);
    expect(await playlistsInDb(user.id)).toHaveLength(1);
  });

  test('401: обліковий запис видалено, а токен ще дійсний', async () => {
    const user = await createUser();
    await query('DELETE FROM users WHERE id = $1', [user.id]);

    const res = await request(app)
      .post('/api/playlists')
      .set('Authorization', user.auth)
      .send({ title: 'Після видалення' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

describeDb('GET /api/playlists/:id', () => {
  test('200: власний плейлист з порожнім списком треків', async () => {
    const user = await createUser();
    const playlist = await createPlaylist(user, 'Новий');

    const res = await request(app)
      .get(`/api/playlists/${playlist.id}`)
      .set('Authorization', user.auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ playlist, tracks: [] });
  });

  test('404: чужий плейлист', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const playlist = await createPlaylist(owner, 'Приватний');

    const res = await request(app)
      .get(`/api/playlists/${playlist.id}`)
      .set('Authorization', stranger.auth);

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'PLAYLIST_NOT_FOUND', message: 'Плейлист не знайдено' });
  });

  test('404: плейлиста не існує', async () => {
    const user = await createUser();

    const res = await request(app)
      .get(`/api/playlists/${UNKNOWN_ID}`)
      .set('Authorization', user.auth);

    expect(res.status).toBe(404);
  });

  test('400: некоректний ідентифікатор', async () => {
    const user = await createUser();

    const res = await request(app).get('/api/playlists/not-a-uuid').set('Authorization', user.auth);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'id', message: 'Некоректний ідентифікатор плейлиста' },
    ]);
  });
});
