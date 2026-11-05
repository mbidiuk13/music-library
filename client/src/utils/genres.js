/**
 * @module utils/genres
 * @description Кольори плиток жанрів на сторінці пошуку (рис. 4.3 ТЗ, розділ «Дизайн» SPEC):
 * теплі й фіолетові тони гами «Захід сонця».
 */

/** Градієнти плиток жанрів з макета. */
const GENRE_GRADIENTS = Object.freeze({
  Електроніка: ['#ff7a59', '#e2553f'],
  Поп: ['#c04cfd', '#9333ea'],
  Інді: ['#ff4f8b', '#be185d'],
  Рок: ['#3b2f5c', '#251d40'],
  'Хіп-хоп': ['#ffb347', '#f0782f'],
  Джаз: ['#7b2ff7', '#5b21b6'],
  Чіл: ['#f472b6', '#db2777'],
  Класика: ['#4a3d6e', '#2e2550'],
});

/** Ті самі градієнти по порядку — для жанрів словника, яких немає на макеті. */
const FALLBACK_GRADIENTS = Object.values(GENRE_GRADIENTS);

/**
 * Повертає CSS-градієнт плитки жанру.
 * @param {string} genre - назва жанру зі словника.
 * @param {number} index - позиція жанру у словнику (для жанрів поза макетом).
 * @returns {string} значення CSS `background`.
 */
export function genreGradient(genre, index) {
  const [from, to] =
    GENRE_GRADIENTS[genre] ?? FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}
