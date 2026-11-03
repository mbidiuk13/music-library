/**
 * @file Інтеграційні тести Recommendation Engine: Топ-100 і обидві гілки персональних
 * рекомендацій (k < M → популярне, k ≥ M → косинусна подібність).
 * Інші тестові файли паралельно додають треки в ту саму БД, тому перевірки не залежать
 * від загального складу медіатеки.
 */

import request from 'supertest';
import createApp from '../src/app.js';
import { closePool, query } from '../src/db/pool.js';
import { describeDb } from './helpers/db.js';
import { insertTestTrack } from './helpers/media.js';
import { createUser } from './helpers/playlists.js';

const app = createApp();

/** Профіль уподобань користувача в тестах персональної гілки. */
const METAL = {
  genre: 'Метал',
  key_signature: 'D# minor',
  mood: 'агресивний',
  bpm: 200,
  year: 1985,
};

/** Профіль, що не має з METAL спільних категоріальних ознак. */
const CALM = {
  genre: 'Класика',
  key_signature: 'C major',
  mood: 'спокійний',
  bpm: 60,
  year: 1990,
};

/**
 * Записує прослуховування треків користувачем у user_listen_history.
 * @param {string} userId - UUID користувача.
 * @param {string[]} trackIds - UUID треків (можна з повторами).
 * @returns {Promise<void>}
 */
async function listen(userId, trackIds) {
  for (const trackId of trackIds) {
    await query('INSERT INTO user_listen_history (user_id, track_id) VALUES ($1, $2)', [
      userId,
      trackId,
    ]);
  }
}

/**
 * Створює кілька треків з однаковими метаданими.
 * @param {number} count - кількість треків.
 * @param {object} metadata - метадані треків.
 * @returns {Promise<object[]>} створені треки.
 */
function insertTracks(count, metadata) {
  return Promise.all(
    Array.from({ length: count }, (_, i) => insertTestTrack({ ...metadata, title: `Трек ${i}` })),
  );
}

afterAll(() => closePool());

describeDb('GET /api/recommendations/popular', () => {
  test('200 без токена: Топ-100 за play_count, найпопулярніший — першим, без s3_key', async () => {
    const hit = await insertTestTrack({ title: 'Хіт', play_count: 2_000_000_000 });

    const res = await request(app).get('/api/recommendations/popular');

    expect(res.status).toBe(200);
    const { tracks } = res.body;
    expect(tracks[0].id).toBe(hit.id);
    expect(tracks.length).toBeLessThanOrEqual(100);
    const counts = tracks.map((t) => t.play_count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(tracks[0]).not.toHaveProperty('s3_key');
  });
});

describeDb('GET /api/recommendations/personal', () => {
  test('401 без токена', async () => {
    const res = await request(app).get('/api/recommendations/personal');
    expect(res.status).toBe(401);
  });

  test('k < M (4 унікальні треки, 6 прослуховувань) → резервна гілка popular', async () => {
    const user = await createUser();
    const tracks = await insertTracks(4, {});
    await listen(user.id, [...tracks.map((t) => t.id), tracks[0].id, tracks[1].id]);

    const res = await request(app)
      .get('/api/recommendations/personal')
      .set('Authorization', user.auth);

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('popular');
    const counts = res.body.tracks.map((t) => t.play_count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(res.body.tracks[0]).not.toHaveProperty('similarity');
  });

  describe('k ≥ M (5 унікальних прослуханих треків)', () => {
    let user;
    let listened;
    let similar;
    let calm;

    beforeAll(async () => {
      user = await createUser();
      listened = await insertTracks(5, METAL);
      [similar, calm] = await Promise.all([
        insertTestTrack({ ...METAL, title: 'Схожий' }),
        insertTestTrack({ ...CALM, title: 'Несхожий' }),
      ]);
      await listen(
        user.id,
        listened.map((t) => t.id),
      );
    });

    /**
     * Запитує персональні рекомендації тестового користувача.
     * @returns {Promise<import('supertest').Response>} відповідь сервера.
     */
    const getPersonal = () =>
      request(app).get('/api/recommendations/personal').set('Authorization', user.auth);

    test('персональна гілка: N ≤ 20 треків з полем similarity за спаданням', async () => {
      const res = await getPersonal();

      expect(res.status).toBe(200);
      expect(res.body.source).toBe('personal');
      const { tracks } = res.body;
      expect(tracks.length).toBeGreaterThan(0);
      expect(tracks.length).toBeLessThanOrEqual(20);
      expect(tracks[0]).not.toHaveProperty('s3_key');

      const scored = tracks.filter((t) => t.similarity !== null);
      const sims = scored.map((t) => t.similarity);
      expect(sims).toEqual([...sims].sort((a, b) => b - a));
      expect(sims.every((s) => s >= 0 && s <= 1 + 1e-9)).toBe(true);
      // Доповнення популярними (similarity: null) — лише після персональної добірки.
      expect(tracks.slice(0, scored.length)).toEqual(scored);
    });

    test('трек з тими самими ознаками — першим, з подібністю ≈ 1; несхожий — нижче', async () => {
      const { tracks } = (await getPersonal()).body;

      expect(tracks[0].id).toBe(similar.id);
      expect(tracks[0].similarity).toBeCloseTo(1, 6);
      const calmEntry = tracks.find((t) => t.id === calm.id);
      if (calmEntry) expect(calmEntry.similarity).toBeLessThan(tracks[0].similarity);
    });

    test('прослухані треки не входять до персональної добірки', async () => {
      const { tracks } = (await getPersonal()).body;
      const listenedIds = new Set(listened.map((t) => t.id));

      const scoredIds = tracks.filter((t) => t.similarity !== null).map((t) => t.id);
      expect(scoredIds.some((id) => listenedIds.has(id))).toBe(false);
    });

    test('правки метаданих адміністратором враховуються одразу (без кешу)', async () => {
      const before = (await getPersonal()).body.tracks.find((t) => t.id === calm.id);
      await query('UPDATE track SET genre = $1, key_signature = $2, mood = $3 WHERE id = $4', [
        METAL.genre,
        METAL.key_signature,
        METAL.mood,
        calm.id,
      ]);

      const after = (await getPersonal()).body.tracks.find((t) => t.id === calm.id);
      // Збіглися три категоріальні ознаки з трьох: sim ≥ 3 / (√5 · √3) ≈ 0.77.
      expect(after.similarity).toBeGreaterThan(0.75);
      expect(after.similarity).toBeGreaterThan(before?.similarity ?? 0);
    });
  });
});
