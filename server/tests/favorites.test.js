/**
 * @file Інтеграційні тести «Улюблених» (FR-9): шорткати для «сердечка» `/api/favorites`,
 * ізоляція даних різних користувачів, плейлист «Улюблені» одразу після реєстрації.
 * Працюють з окремою тестовою БД (TEST_DATABASE_URL).
 */

import request from 'supertest';
import createApp from '../src/app.js';
import { closePool, query } from '../src/db/pool.js';
import { describeDb, uniqueEmail } from './helpers/db.js';
import { insertTestTrack } from './helpers/media.js';
import { createUser, trackIdsInDb } from './helpers/playlists.js';

const app = createApp();
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/**
 * Додає трек до «Улюблених» через API.
 * @param {{auth: string}} user - користувач.
 * @param {string} trackId - UUID треку.
 * @returns {import('supertest').Test} запит.
 */
function like(user, trackId) {
  return request(app).post(`/api/favorites/${trackId}`).set('Authorization', user.auth);
}

/**
 * Прибирає трек з «Улюблених» через API.
 * @param {{auth: string}} user - користувач.
 * @param {string} trackId - UUID треку.
 * @returns {import('supertest').Test} запит.
 */
function unlike(user, trackId) {
  return request(app).delete(`/api/favorites/${trackId}`).set('Authorization', user.auth);
}

/**
 * Повертає ідентифікатори улюблених треків через API.
 * @param {{auth: string}} user - користувач.
 * @returns {Promise<string[]>} UUID треків.
 */
async function favoriteIds(user) {
  const res = await request(app).get('/api/favorites/ids').set('Authorization', user.auth);
  expect(res.status).toBe(200);
  return res.body.ids;
}

afterAll(() => closePool());

describe('«Улюблені» без токена', () => {
  test.each([
    ['get', '/api/favorites/ids'],
    ['post', `/api/favorites/${UNKNOWN_ID}`],
    ['delete', `/api/favorites/${UNKNOWN_ID}`],
  ])('%s %s → 401', async (method, path) => {
    const res = await request(app)[method](path);

    expect(res.status).toBe(401);
  });
});

describeDb('/api/favorites', () => {
  test('GET /ids: у нового користувача порожньо', async () => {
    const user = await createUser();

    expect(await favoriteIds(user)).toEqual([]);
  });

  test('POST: 201, трек потрапляє в плейлист «Улюблені» і в /ids', async () => {
    const user = await createUser();
    const first = await insertTestTrack();
    const second = await insertTestTrack();

    const res = await like(user, first.id);
    await like(user, second.id);

    expect(res.status).toBe(201);
    expect(res.body.track).toMatchObject({ id: first.id, added_at: expect.any(String) });
    expect(await favoriteIds(user)).toEqual([first.id, second.id]);
    expect(await trackIdsInDb(user.favoritesId)).toEqual([first.id, second.id]);

    const list = await request(app).get('/api/playlists').set('Authorization', user.auth);
    expect(list.body.playlists[0]).toMatchObject({ id: user.favoritesId, track_count: 2 });
  });

  test('POST: 409 — трек уже в «Улюблених»', async () => {
    const user = await createUser();
    const track = await insertTestTrack();
    await like(user, track.id);

    const res = await like(user, track.id);

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'TRACK_ALREADY_IN_PLAYLIST',
      message: 'Трек уже є в плейлисті',
    });
    expect(await favoriteIds(user)).toEqual([track.id]);
  });

  test('POST: 404 — трека не існує', async () => {
    const user = await createUser();

    const res = await like(user, UNKNOWN_ID);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRACK_NOT_FOUND');
  });

  test('DELETE: 204, трек зникає з «Улюблених»; повторно — 404', async () => {
    const user = await createUser();
    const track = await insertTestTrack();
    await like(user, track.id);

    const res = await unlike(user, track.id);
    const again = await unlike(user, track.id);

    expect(res.status).toBe(204);
    expect(await favoriteIds(user)).toEqual([]);
    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe('TRACK_NOT_IN_PLAYLIST');
  });

  test('«Улюблені» кожного користувача окремі', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const track = await insertTestTrack();
    await like(alice, track.id);

    expect(await favoriteIds(bob)).toEqual([]);

    const res = await unlike(bob, track.id);
    expect(res.status).toBe(404);
    expect(await favoriteIds(alice)).toEqual([track.id]);
  });

  test('400: некоректний ідентифікатор треку', async () => {
    const user = await createUser();

    const res = await like(user, 'abc');

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'trackId', message: 'Некоректний ідентифікатор треку' },
    ]);
  });

  test('404: обліковий запис видалено, а токен ще дійсний', async () => {
    const user = await createUser();
    const track = await insertTestTrack();
    await query('DELETE FROM users WHERE id = $1', [user.id]);

    const res = await like(user, track.id);

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'PLAYLIST_NOT_FOUND',
      message: 'Плейлист «Улюблені» не знайдено',
    });
  });

  test('після реєстрації через API «Улюблені» вже є і працюють', async () => {
    const email = uniqueEmail('favorites');
    const register = await request(app).post('/api/auth/register').send({
      email,
      username: 'Нова слухачка',
      password: 'Passw0rd!x',
      passwordConfirm: 'Passw0rd!x',
    });
    expect(register.status).toBe(201);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Passw0rd!x' });
    const user = { auth: `Bearer ${login.body.token}` };
    const track = await insertTestTrack();

    expect((await like(user, track.id)).status).toBe(201);

    const list = await request(app).get('/api/playlists').set('Authorization', user.auth);
    expect(list.body.playlists).toEqual([
      expect.objectContaining({ title: 'Улюблені', is_favorites: true, track_count: 1 }),
    ]);
  });
});
