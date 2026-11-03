/**
 * @file Unit-тести логіки Recommendation Engine без БД: вибір гілки алгоритму (k < M),
 * ранжування за косинусною подібністю, виключення прослуханих і доповнення популярними.
 */

import {
  SOURCE,
  chooseSource,
  rankRecommendations,
} from '../src/modules/recommendations/recommendation.service.js';

/**
 * Формує трек для тестів; окремі поля можна перевизначити.
 * @param {string} id - ідентифікатор треку.
 * @param {object} [overrides] - поля, які треба замінити.
 * @returns {object} метадані треку.
 */
function track(id, overrides = {}) {
  return {
    id,
    title: `Трек ${id}`,
    artist: 'Виконавець',
    genre: 'Рок',
    key_signature: 'E minor',
    mood: 'агресивний',
    bpm: 160,
    year: 2000,
    play_count: 0,
    ...overrides,
  };
}

describe('chooseSource', () => {
  test('k < M → резервна гілка popular', () => {
    expect(chooseSource(0, 5)).toBe(SOURCE.POPULAR);
    expect(chooseSource(4, 5)).toBe(SOURCE.POPULAR);
  });

  test('k ≥ M → персональна гілка', () => {
    expect(chooseSource(5, 5)).toBe(SOURCE.PERSONAL);
    expect(chooseSource(42, 5)).toBe(SOURCE.PERSONAL);
  });
});

describe('rankRecommendations', () => {
  // Медіатека: bpm 60–160, рік 1990–2010. Прослухано два рокові треки.
  const library = [
    track('l1', { bpm: 160, year: 2010 }),
    track('l2', { bpm: 160, year: 2010, play_count: 50 }),
    track('same', { bpm: 160, year: 2010 }),
    track('genre-only', { key_signature: 'C major', mood: 'спокійний', bpm: 60, year: 1990 }),
    track('other', {
      genre: 'Класика',
      key_signature: 'C major',
      mood: 'спокійний',
      bpm: 60,
      year: 1990,
      play_count: 100,
    }),
  ];
  const listened = ['l1', 'l2'];

  test('прослухані треки не потрапляють до персональної добірки', () => {
    const ids = rankRecommendations(library, listened, 3).map((t) => t.id);
    expect(ids).toEqual(['same', 'genre-only', 'other']);
    expect(ids).not.toContain('l1');
    expect(ids).not.toContain('l2');
  });

  test('подібність порахована за формулою і відсортована за спаданням', () => {
    const result = rankRecommendations(library, listened, 3);
    // A_user = B_same = one-hot(Рок, E minor, агресивний) + (1, 1): ‖A‖ = √5.
    // genre-only = one-hot(Рок, C major, спокійний) + (0, 0): ‖B‖ = √3, спільний лише жанр:
    //   sim = 1 / (√5 · √3) = 1/√15 ≈ 0.258.
    // other: жодної спільної ознаки → 0.
    expect(result[0].similarity).toBeCloseTo(1, 10);
    expect(result[1].similarity).toBeCloseTo(1 / Math.sqrt(15), 10);
    expect(result[2].similarity).toBe(0);
  });

  test('повертає не більше N треків', () => {
    expect(rankRecommendations(library, listened, 2).map((t) => t.id)).toEqual([
      'same',
      'genre-only',
    ]);
  });

  test('за рівної подібності вище — популярніший трек', () => {
    const tracks = [...library, track('same-popular', { bpm: 160, year: 2010, play_count: 7 })];
    const ids = rankRecommendations(tracks, listened, 2).map((t) => t.id);
    expect(ids).toEqual(['same-popular', 'same']);
  });

  test('кандидатів менше за N → доповнення популярними, яких ще немає у списку', () => {
    const result = rankRecommendations(library, listened, 5);
    expect(result.map((t) => t.id)).toEqual(['same', 'genre-only', 'other', 'l2', 'l1']);
    expect(result.slice(3).every((t) => t.similarity === null)).toBe(true);
    expect(new Set(result.map((t) => t.id)).size).toBe(result.length);
  });

  test('медіатека менша за N → повертаються всі треки без повторів', () => {
    expect(rankRecommendations(library, listened, 20)).toHaveLength(library.length);
  });
});
