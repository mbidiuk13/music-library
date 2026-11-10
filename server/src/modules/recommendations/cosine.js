/**
 * @module modules/recommendations/cosine
 * @description Векторні операції Recommendation Engine на основі бібліотеки mathjs
 * (розділ 3.3.1 ПЗ): вектор уподобань користувача і косинусна подібність.
 * Модуль містить лише чисті функції без доступу до БД.
 */

import { add, divide, dot, norm } from 'mathjs';

/**
 * Обчислює вектор уподобань користувача — середнє арифметичне векторів прослуханих треків:
 *   A_user = (1/k) · Σ_{j=1..k} B_j,
 * де k — кількість унікальних прослуханих треків, B_j — вектор j-го треку.
 * @param {number[][]} vectors - вектори прослуханих треків (однакової розмірності), k ≥ 1.
 * @returns {number[]} вектор уподобань A_user.
 * @throws {Error} якщо список векторів порожній.
 */
export function preferenceVector(vectors) {
  if (vectors.length === 0) {
    throw new Error('Для вектора уподобань потрібен хоча б один прослуханий трек');
  }
  const [first, ...rest] = vectors;
  const sum = rest.reduce((acc, vector) => add(acc, vector), first);
  return divide(sum, vectors.length);
}

/**
 * Косинусна подібність двох векторів:
 *   sim(A, B) = (A · B) / (‖A‖ · ‖B‖),
 * де A · B — скалярний добуток, ‖A‖ — евклідова норма. Якщо хоча б один вектор нульовий
 * (знаменник дорівнює 0), подібність вважається 0. Для векторів з невід'ємними
 * компонентами результат лежить у межах [0; 1].
 * @param {number[]} a - перший вектор (напр. вектор уподобань A_user).
 * @param {number[]} b - другий вектор тієї самої розмірності (напр. вектор треку B).
 * @returns {number} значення подібності.
 */
export function cosineSimilarity(a, b) {
  const denominator = norm(a) * norm(b);
  if (denominator === 0) return 0;
  return dot(a, b) / denominator;
}
