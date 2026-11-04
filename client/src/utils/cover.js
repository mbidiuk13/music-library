/**
 * @module utils/cover
 * @description Обкладинки треків. Справжніх обкладинок немає — квадрат із градієнтом,
 * пара кольорів якого детерміновано обирається з id треку (розділ «Дизайн» SPEC).
 */

/** Набір градієнтів гами «Захід сонця». */
const COVER_GRADIENTS = [
  ['#ff7a59', '#c04cfd'],
  ['#ffb347', '#ff4f8b'],
  ['#ff4f8b', '#7b2ff7'],
  ['#f9d423', '#ff4e50'],
  ['#c04cfd', '#5b2bff'],
];

/**
 * Обчислює невід'ємний хеш рядка (djb2), щоб той самий id завжди давав той самий колір.
 * @param {string} value - рядок (UUID треку).
 * @returns {number} ціле невід'ємне число.
 */
function hashString(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Повертає CSS-градієнт обкладинки для треку.
 * @param {string} trackId - UUID треку.
 * @returns {string} значення CSS `background`.
 */
export function coverGradient(trackId) {
  const [from, to] = COVER_GRADIENTS[hashString(String(trackId)) % COVER_GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}
