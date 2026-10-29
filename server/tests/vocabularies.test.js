/**
 * @file Unit-тести словників метаданих і їх відповідності database/seed.sql.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GENRES, MOODS, KEYS, BPM_RANGE, getYearRange } from '../src/config/vocabularies.js';

const seedPath = fileURLToPath(new URL('../../database/seed.sql', import.meta.url));

/**
 * Витягує метадані треків із рядків VALUES у seed.sql.
 * @param {string} sql - вміст seed.sql.
 * @returns {Array<{genre: string, bpm: number, key: string, mood: string, year: number, s3Key: string}>}
 */
function parseSeedTracks(sql) {
  const row = /', '([^']+)', (\d+), '([^']+)', '([^']+)', (\d+), '([^']+)'\)/g;
  return [...sql.matchAll(row)].map(([, genre, bpm, key, mood, year, s3Key]) => ({
    genre,
    bpm: Number(bpm),
    key,
    mood,
    year: Number(year),
    s3Key,
  }));
}

const tracks = parseSeedTracks(readFileSync(seedPath, 'utf8'));

describe('словники метаданих', () => {
  test('мають розмірність 12 + 24 + 8 (вектор треку — 46 компонент)', () => {
    expect(GENRES).toHaveLength(12);
    expect(KEYS).toHaveLength(24);
    expect(MOODS).toHaveLength(8);
  });

  test('не містять дублікатів', () => {
    for (const list of [GENRES, KEYS, MOODS]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });

  test('тональності записано у форматі «нота лад»', () => {
    expect(KEYS).toContain('A minor');
    expect(KEYS).toContain('F# minor');
    expect(KEYS).toContain('C major');
  });

  test('рік — від 1 до наступного року', () => {
    expect(getYearRange(new Date('2026-10-29'))).toEqual({ min: 1, max: 2027 });
  });
});

describe('database/seed.sql', () => {
  test('містить 50 треків', () => {
    expect(tracks).toHaveLength(50);
  });

  test.each(tracks)('$s3Key: метадані зі словників', ({ genre, bpm, key, mood, year, s3Key }) => {
    expect(GENRES).toContain(genre);
    expect(KEYS).toContain(key);
    expect(MOODS).toContain(mood);
    expect(bpm).toBeGreaterThanOrEqual(BPM_RANGE.min);
    expect(bpm).toBeLessThanOrEqual(BPM_RANGE.max);
    expect(year).toBeGreaterThanOrEqual(getYearRange().min);
    expect(year).toBeLessThanOrEqual(getYearRange().max);
    expect(s3Key).toMatch(/^tracks\/[a-z0-9_]+\.mp3$/);
  });
});
