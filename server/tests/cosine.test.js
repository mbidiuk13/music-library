/**
 * @file Unit-тести косинусної подібності і вектора уподобань (mathjs) Recommendation Engine.
 */

import { cosineSimilarity, preferenceVector } from '../src/modules/recommendations/cosine.js';

describe('cosineSimilarity', () => {
  test('ідентичні вектори → 1', () => {
    const v = [1, 0, 0, 1, 0.25, 0.8];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10);
  });

  test('співнапрямлені вектори різної довжини → 1', () => {
    expect(cosineSimilarity([1, 2, 0], [2, 4, 0])).toBeCloseTo(1, 10);
  });

  test('ортогональні вектори → 0', () => {
    expect(cosineSimilarity([1, 0, 1, 0], [0, 1, 0, 1])).toBe(0);
  });

  test('приклад, порахований вручну', () => {
    // A = (1, 1, 0), B = (1, 0, 1): A·B = 1, ‖A‖ = ‖B‖ = √2 → sim = 1 / 2.
    expect(cosineSimilarity([1, 1, 0], [1, 0, 1])).toBeCloseTo(0.5, 10);
    // A = (1, 2, 2), B = (2, 0, 1): A·B = 4, ‖A‖ = 3, ‖B‖ = √5 → sim = 4 / (3√5) ≈ 0.596285.
    expect(cosineSimilarity([1, 2, 2], [2, 0, 1])).toBeCloseTo(4 / (3 * Math.sqrt(5)), 10);
  });

  test('нульовий вектор → 0 (без ділення на нуль)', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
  });

  test('для невід’ємних векторів результат лежить у [0; 1]', () => {
    const sim = cosineSimilarity([0.2, 1, 0, 0.7], [1, 0, 0.3, 0.1]);
    expect(sim).toBeGreaterThanOrEqual(0);
    expect(sim).toBeLessThanOrEqual(1);
  });
});

describe('preferenceVector', () => {
  test('середнє векторів прослуханих треків: (1/k) · Σ B_j', () => {
    const vectors = [
      [1, 0, 0.5],
      [0, 1, 0.25],
      [1, 0, 0],
      [0, 1, 0.25],
    ];
    expect(preferenceVector(vectors)).toEqual([0.5, 0.5, 0.25]);
  });

  test('один трек → його власний вектор', () => {
    expect(preferenceVector([[0, 1, 0.4]])).toEqual([0, 1, 0.4]);
  });

  test('порожня історія → помилка', () => {
    expect(() => preferenceVector([])).toThrow();
  });
});
