/**
 * @file Інтеграційні тести вмісту плейлистів (UC-4, UC-11, FR-10): додавання треку, повторне
 * додавання, вилучення треку, створення плейлиста з першим треком в одній транзакції,
 * доступ лише до власних плейлистів.
 * Працюють з окремою тестовою БД (TEST_DATABASE_URL).
 */

import request from 'supertest';
import createApp from '../src/app.js';
import { closePool } from '../src/db/pool.js';
import { describeDb } from './helpers/db.js';
import { insertTestTrack } from './helpers/media.js';
import { createUser, playlistsInDb, trackIdsInDb } from './helpers/playlists.js';

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

/**
 * Надсилає запит на додавання треку до плейлиста.
 * @param {{auth: string}} user - користувач.
 * @param {string} playlistId - UUID плейлиста.
 * @param {object} payload - тіло запиту.
 * @returns {import('supertest').Test} запит.
 */
function addTrack(user, playlistId, payload) {
  return request(app)
    .post(`/api/playlists/${playlistId}/tracks`)
    .set('Authorization', user.auth)
    .send(payload);
}

/**
 * Надсилає запит на вилучення треку з плейлиста.
 * @param {{auth: string}} user - користувач.
 * @param {string} playlistId - UUID плейлиста.
 * @param {string} trackId - UUID треку.
 * @returns {import('supertest').Test} запит.
 */
function removeTrack(user, playlistId, trackId) {
  return request(app)
    .delete(`/api/playlists/${playlistId}/tracks/${trackId}`)
    .set('Authorization', user.auth);
}

afterAll(() => closePool());

describe('Вміст плейлиста без токена', () => {
  test('POST /api/playlists/:id/tracks → 401', async () => {
    const res = await request(app)
      .post(`/api/playlists/${UNKNOWN_ID}/tracks`)
      .send({ trackId: UNKNOWN_ID });

    expect(res.status).toBe(401);
  });

  test('DELETE /api/playlists/:id/tracks/:trackId → 401', async () => {
    const res = await request(app).delete(`/api/playlists/${UNKNOWN_ID}/tracks/${UNKNOWN_ID}`);

    expect(res.status).toBe(401);
  });
});

describeDb('POST /api/playlists/:id/tracks', () => {
  test('201: додає трек; він видний у плейлисті й у лічильнику', async () => {
    const user = await createUser();
    const playlist = await createPlaylist(user, 'Для роботи');
    const track = await insertTestTrack({ title: 'Фокус' });

    const res = await addTrack(user, playlist.id, { trackId: track.id });

    expect(res.status).toBe(201);
    expect(res.body.track).toEqual({
      id: track.id,
      title: 'Фокус',
      artist: track.artist,
      genre: track.genre,
      bpm: track.bpm,
      key_signature: track.key_signature,
      mood: track.mood,
      year: track.year,
      play_count: track.play_count,
      added_at: expect.any(String),
    });

    const details = await request(app)
      .get(`/api/playlists/${playlist.id}`)
      .set('Authorization', user.auth);
    expect(details.body.playlist.track_count).toBe(1);
    expect(details.body.tracks).toEqual([res.body.track]);
    expect(details.body.tracks[0]).not.toHaveProperty('s3_key');

    const list = await request(app).get('/api/playlists').set('Authorization', user.auth);
    expect(list.body.playlists.find((p) => p.id === playlist.id).track_count).toBe(1);
  });

  test('треки в плейлисті — в порядку додавання', async () => {
    const user = await createUser();
    const playlist = await createPlaylist(user, 'Порядок');
    const first = await insertTestTrack({ title: 'Я останній за абеткою' });
    const second = await insertTestTrack({ title: 'А перший за абеткою' });
    await addTrack(user, playlist.id, { trackId: first.id });
    await addTrack(user, playlist.id, { trackId: second.id });

    const res = await request(app)
      .get(`/api/playlists/${playlist.id}`)
      .set('Authorization', user.auth);

    expect(res.body.tracks.map((t) => t.id)).toEqual([first.id, second.id]);
  });

  test('409: трек уже є в плейлисті, дубль не додається', async () => {
    const user = await createUser();
    const playlist = await createPlaylist(user, 'Без повторів');
    const track = await insertTestTrack();
    await addTrack(user, playlist.id, { trackId: track.id });

    const res = await addTrack(user, playlist.id, { trackId: track.id });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'TRACK_ALREADY_IN_PLAYLIST',
      message: 'Трек уже є в плейлисті',
    });
    expect(await trackIdsInDb(playlist.id)).toEqual([track.id]);
  });

  test('201: той самий трек можна додати в різні плейлисти', async () => {
    const user = await createUser();
    const first = await createPlaylist(user, 'Перший');
    const second = await createPlaylist(user, 'Другий');
    const track = await insertTestTrack();
    await addTrack(user, first.id, { trackId: track.id });

    const res = await addTrack(user, second.id, { trackId: track.id });

    expect(res.status).toBe(201);
  });

  test('201: трек можна додати і в «Улюблені»', async () => {
    const user = await createUser();
    const track = await insertTestTrack();

    const res = await addTrack(user, user.favoritesId, { trackId: track.id });

    expect(res.status).toBe(201);
    expect(await trackIdsInDb(user.favoritesId)).toEqual([track.id]);
  });

  test('404: трека не існує', async () => {
    const user = await createUser();
    const playlist = await createPlaylist(user, 'Порожній');

    const res = await addTrack(user, playlist.id, { trackId: UNKNOWN_ID });

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'TRACK_NOT_FOUND', message: 'Трек не знайдено' });
    expect(await trackIdsInDb(playlist.id)).toEqual([]);
  });

  test('404: у чужий плейлист трек не додається', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const playlist = await createPlaylist(owner, 'Чужий');
    const track = await insertTestTrack();

    const res = await addTrack(stranger, playlist.id, { trackId: track.id });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAYLIST_NOT_FOUND');
    expect(await trackIdsInDb(playlist.id)).toEqual([]);
  });

  test('404: у чужі «Улюблені» трек не додається', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const track = await insertTestTrack();

    const res = await addTrack(stranger, owner.favoritesId, { trackId: track.id });

    expect(res.status).toBe(404);
    expect(await trackIdsInDb(owner.favoritesId)).toEqual([]);
  });

  test('404: плейлиста не існує', async () => {
    const user = await createUser();
    const track = await insertTestTrack();

    const res = await addTrack(user, UNKNOWN_ID, { trackId: track.id });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAYLIST_NOT_FOUND');
  });

  test.each([
    ['без trackId', {}],
    ['не UUID', { trackId: 'abc' }],
    ['не рядок', { trackId: 123 }],
  ])('400: %s', async (name, payload) => {
    const user = await createUser();

    const res = await addTrack(user, user.favoritesId, payload);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'trackId', message: 'Некоректний ідентифікатор треку' },
    ]);
  });
});

describeDb('DELETE /api/playlists/:id/tracks/:trackId', () => {
  test('204: прибирає трек з плейлиста, інші треки лишаються', async () => {
    const user = await createUser();
    const playlist = await createPlaylist(user, 'Чистка');
    const keep = await insertTestTrack();
    const remove = await insertTestTrack();
    await addTrack(user, playlist.id, { trackId: keep.id });
    await addTrack(user, playlist.id, { trackId: remove.id });

    const res = await removeTrack(user, playlist.id, remove.id);

    expect(res.status).toBe(204);
    expect(await trackIdsInDb(playlist.id)).toEqual([keep.id]);
  });

  test('404: трека немає в плейлисті', async () => {
    const user = await createUser();
    const playlist = await createPlaylist(user, 'Порожній');
    const track = await insertTestTrack();

    const res = await removeTrack(user, playlist.id, track.id);

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'TRACK_NOT_IN_PLAYLIST',
      message: 'Трека немає в плейлисті',
    });
  });

  test('404: з чужого плейлиста трек не прибирається', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const playlist = await createPlaylist(owner, 'Мій');
    const track = await insertTestTrack();
    await addTrack(owner, playlist.id, { trackId: track.id });

    const res = await removeTrack(stranger, playlist.id, track.id);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAYLIST_NOT_FOUND');
    expect(await trackIdsInDb(playlist.id)).toEqual([track.id]);
  });

  test('400: некоректний ідентифікатор треку', async () => {
    const user = await createUser();

    const res = await removeTrack(user, user.favoritesId, 'abc');

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'trackId', message: 'Некоректний ідентифікатор треку' },
    ]);
  });
});

describeDb('POST /api/playlists/with-track', () => {
  /**
   * Надсилає запит на створення плейлиста з треком.
   * @param {{auth: string}} user - користувач.
   * @param {object} payload - тіло запиту.
   * @returns {import('supertest').Test} запит.
   */
  const createWithTrack = (user, payload) =>
    request(app).post('/api/playlists/with-track').set('Authorization', user.auth).send(payload);

  test('201: створює плейлист і додає до нього трек', async () => {
    const user = await createUser();
    const track = await insertTestTrack();

    const res = await createWithTrack(user, { title: ' Новий з треком ', trackId: track.id });

    expect(res.status).toBe(201);
    expect(res.body.playlist).toEqual({
      id: expect.any(String),
      title: 'Новий з треком',
      created_at: expect.any(String),
      track_count: 1,
      is_favorites: false,
    });
    expect(res.body.track).toMatchObject({ id: track.id, added_at: expect.any(String) });
    expect(await trackIdsInDb(res.body.playlist.id)).toEqual([track.id]);
  });

  test('404 і ROLLBACK: трека не існує — порожній плейлист не створюється', async () => {
    const user = await createUser();

    const res = await createWithTrack(user, { title: 'Не має з’явитися', trackId: UNKNOWN_ID });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRACK_NOT_FOUND');
    expect(await playlistsInDb(user.id)).toEqual([{ id: user.favoritesId, title: 'Улюблені' }]);
  });

  test('409: дубль назви — нічого не створюється і не додається', async () => {
    const user = await createUser();
    const existing = await createPlaylist(user, 'Вже є');
    const track = await insertTestTrack();

    const res = await createWithTrack(user, { title: 'Вже є', trackId: track.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLAYLIST_TITLE_TAKEN');
    expect(await playlistsInDb(user.id)).toHaveLength(2);
    expect(await trackIdsInDb(existing.id)).toEqual([]);
  });

  test('400: перевіряються і назва, і трек', async () => {
    const user = await createUser();

    const res = await createWithTrack(user, { title: '', trackId: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'title', message: 'Введіть назву плейлиста' },
      { field: 'trackId', message: 'Некоректний ідентифікатор треку' },
    ]);
  });

  test('401: без токена', async () => {
    const res = await request(app)
      .post('/api/playlists/with-track')
      .send({ title: 'Гість', trackId: UNKNOWN_ID });

    expect(res.status).toBe(401);
  });
});
