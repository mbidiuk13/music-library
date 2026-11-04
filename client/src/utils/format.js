/**
 * @module utils/format
 * @description Форматування значень для відображення в інтерфейсі.
 */

/**
 * Форматує тривалість у вигляді «хв:сс» (або «год:хв:сс» для довгих записів).
 * @param {number} seconds - тривалість у секундах.
 * @returns {string} напр. `3:07`; для некоректного значення — `0:00`.
 */
export function formatTime(seconds) {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}
