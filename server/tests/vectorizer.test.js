/**
 * @file Unit-тести векторизації треку (one-hot + min-max) Recommendation Engine.
 */

import { GENRES, KEYS, MOODS } from '../src/config/vocabularies.js';
import {
  VECTOR_DIMENSION,
  getNumericRanges,
  minMax,
  oneHot,
  vectorizeTrack,
} from '../src/modules/recommendations/vectorizer.js';

/** Межі числових ознак для прикладів: bpm 60–180, рік 1980–2020. */
const RANGES = { bpm: { min: 60, max: 180 }, year: { min: 1980, max: 2020 } };

describe('oneHot', () => {
  test('ставить 1 лише на позицію значення у словнику', () => {
    expect(oneHot('Рок', GENRES)).toEqual([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test('значення поза словником кодується нульовим вектором', () => {
    expect(oneHot('rock', GENRES)).toEqual(new Array(GENRES.length).fill(0));
  });
});

describe('minMax', () => {
  test('мінімум → 0, максимум → 1, середина → 0.5', () => {
    expect(minMax(60, 60, 180)).toBe(0);
    expect(minMax(180, 60, 180)).toBe(1);
    expect(minMax(120, 60, 180)).toBe(0.5);
  });

  test('x_max = x_min → 0 (без ділення на нуль)', () => {
    expect(minMax(120, 120, 120)).toBe(0);
  });
});

describe('getNumericRanges', () => {
  test('знаходить мінімум і максимум bpm та року по всіх треках', () => {
    const tracks = [
      { bpm: 100, year: 2001 },
      { bpm: 60, year: 2020 },
      { bpm: 180, year: 1980 },
    ];
    expect(getNumericRanges(tracks)).toEqual(RANGES);
  });

  test('один трек → x_min = x_max', () => {
    expect(getNumericRanges([{ bpm: 90, year: 1999 }])).toEqual({
      bpm: { min: 90, max: 90 },
      year: { min: 1999, max: 1999 },
    });
  });

  test('порожня медіатека → нульові межі', () => {
    expect(getNumericRanges([])).toEqual({ bpm: { min: 0, max: 0 }, year: { min: 0, max: 0 } });
  });
});

describe('vectorizeTrack', () => {
  const track = {
    genre: 'Поп',
    key_signature: 'A minor',
    mood: 'енергійний',
    bpm: 150,
    year: 2010,
  };

  test('має розмірність n = 46', () => {
    expect(VECTOR_DIMENSION).toBe(46);
    expect(vectorizeTrack(track, RANGES)).toHaveLength(46);
  });

  test('складається з one-hot жанру, тональності, настрою та нормалізованих bpm і року', () => {
    const vector = vectorizeTrack(track, RANGES);
    const genres = vector.slice(0, 12);
    const keys = vector.slice(12, 36);
    const moods = vector.slice(36, 44);

    expect(genres[GENRES.indexOf('Поп')]).toBe(1);
    expect(genres.reduce((a, b) => a + b)).toBe(1);
    expect(keys[KEYS.indexOf('A minor')]).toBe(1);
    expect(keys.reduce((a, b) => a + b)).toBe(1);
    expect(moods[MOODS.indexOf('енергійний')]).toBe(1);
    expect(moods.reduce((a, b) => a + b)).toBe(1);
    expect(vector.slice(44)).toEqual([0.75, 0.75]);
  });

  test('усі компоненти невід’ємні', () => {
    const vector = vectorizeTrack({ ...track, bpm: 60, year: 1980 }, RANGES);
    expect(vector.every((x) => x >= 0)).toBe(true);
    expect(vector.slice(44)).toEqual([0, 0]);
  });
});
