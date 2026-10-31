/**
 * @file Інтеграційні тести відтворення (UC-7): видача pre-signed URL і облік прослуховувань
 * (`play_count` та історія користувача в одній транзакції). Підписування посилання S3 підмінено.
 */

import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import request from 'supertest';
import createApp from '../src/app.js';
import { closePool, pool, query } from '../src/db/pool.js';
import s3 from '../src/services/s3.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { describeDb } from './helpers/db.js';
import { insertTestTrack } from './helpers/media.js';

const app = createApp();
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/**
 * Створює користувача в тестовій БД і токен доступу для нього.
 * @returns {Promise<{id: string, token: string}>} ідентифікатор і токен.
 */
async function createUser() {
  const email = `listener-${randomUUID()}@test.local`;
  const { rows } = await query(
    `INSERT INTO users (email, username, password_hash) VALUES ($1, 'Слухач', 'x') RETURNING id`,
    [email],
  );
  const { id } = rows[0];
  return { id, token: signAccessToken({ id, role: 'user', email }) };
}

/**
 * Повертає лічильник відтворень треку.
 * @param {string} id - UUID треку.
 * @returns {Promise<number>} play_count.
 */
async function playCount(id) {
  const { rows } = await query('SELECT play_count FROM track WHERE id = $1', [id]);
  return rows[0].play_count;
}

/**
 * Повертає кількість записів історії для пари користувач–трек.
 * @param {string} userId - UUID користувача.
 * @param {string} trackId - UUID треку.
 * @returns {Promise<number>} кількість записів.
 */
async function listenCount(userId, trackId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM user_listen_history WHERE user_id = $1 AND track_id = $2',
    [userId, trackId],
  );
  return rows[0].count;
}

afterEach(() => jest.restoreAllMocks());
afterAll(() => closePool());

describeDb('GET /api/tracks/:id/stream', () => {
  test('200: pre-signed URL на файл треку і строк дії 3600 с', async () => {
    const track = await insertTestTrack();
    const presign = jest
      .spyOn(s3, 'getPresignedUrl')
      .mockResolvedValue('https://test-bucket.s3.amazonaws.com/signed');

    const res = await request(app).get(`/api/tracks/${track.id}/stream`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      url: 'https://test-bucket.s3.amazonaws.com/signed',
      expiresIn: 3600,
    });
    expect(presign).toHaveBeenCalledWith(track.s3_key, 3600);
  });

  test('404: трек не існує, посилання не підписується', async () => {
    const presign = jest.spyOn(s3, 'getPresignedUrl');

    const res = await request(app).get(`/api/tracks/${UNKNOWN_ID}/stream`);

    expect(res.status).toBe(404);
    expect(presign).not.toHaveBeenCalled();
  });
});

describeDb('POST /api/tracks/:id/play', () => {
  test('гість: play_count + 1, історія не записується', async () => {
    const track = await insertTestTrack({ play_count: 3 });

    const res = await request(app).post(`/api/tracks/${track.id}/play`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: track.id, play_count: 4 });
    const { rows } = await query('SELECT 1 FROM user_listen_history WHERE track_id = $1', [
      track.id,
    ]);
    expect(rows).toHaveLength(0);
  });

  test('авторизований користувач: play_count + 1 і запис в історії', async () => {
    const track = await insertTestTrack();
    const user = await createUser();

    for (let i = 0; i < 2; i += 1) {
      await request(app)
        .post(`/api/tracks/${track.id}/play`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
    }

    expect(await playCount(track.id)).toBe(2);
    expect(await listenCount(user.id, track.id)).toBe(2);
  });

  test('недійсний токен не блокує відтворення — враховується як гість', async () => {
    const track = await insertTestTrack();

    const res = await request(app)
      .post(`/api/tracks/${track.id}/play`)
      .set('Authorization', 'Bearer broken.token.value');

    expect(res.status).toBe(200);
    expect(res.body.play_count).toBe(1);
  });

  test('токен видаленого користувача: лічильник росте, історія не записується', async () => {
    const track = await insertTestTrack();
    const goneId = randomUUID();
    const token = signAccessToken({ id: goneId, role: 'user', email: 'gone@test.local' });

    const res = await request(app)
      .post(`/api/tracks/${track.id}/play`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(await listenCount(goneId, track.id)).toBe(0);
  });

  test('збій запису історії: ROLLBACK, лічильник не змінюється', async () => {
    const track = await insertTestTrack({ play_count: 10 });
    const user = await createUser();
    const connect = pool.connect.bind(pool);
    jest.spyOn(pool, 'connect').mockImplementation(async () => {
      const client = await connect();
      const runQuery = client.query.bind(client);
      jest
        .spyOn(client, 'query')
        .mockImplementation((text, params) =>
          text.includes('user_listen_history')
            ? Promise.reject(new Error('збій БД'))
            : runQuery(text, params),
        );
      return client;
    });

    const res = await request(app)
      .post(`/api/tracks/${track.id}/play`)
      .set('Authorization', `Bearer ${user.token}`);
    jest.restoreAllMocks();

    expect(res.status).toBe(500);
    expect(await playCount(track.id)).toBe(10);
    expect(await listenCount(user.id, track.id)).toBe(0);
  });

  test('404: трек не існує; 400: некоректний ідентифікатор', async () => {
    const missing = await request(app).post(`/api/tracks/${UNKNOWN_ID}/play`);
    expect(missing.status).toBe(404);

    const invalid = await request(app).post('/api/tracks/abc/play');
    expect(invalid.status).toBe(400);
  });
});
