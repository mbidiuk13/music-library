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

//для жанрів словника, яких немає на макеті
const FALLBACK_GRADIENTS = Object.values(GENRE_GRADIENTS);

export function genreGradient(genre, index) {
  const [from, to] =
    GENRE_GRADIENTS[genre] ?? FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}
