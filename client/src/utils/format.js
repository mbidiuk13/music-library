/**
 * @module utils/format
 * @description Форматування значень для відображення в інтерфейсі.
 */

import i18n from '../i18n/index.js';

/** Кількість мілісекунд в одній добі. */
const DAY_MS = 24 * 60 * 60 * 1000;

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

/**
 * Форматує дату додавання треку до плейлиста (колонка «Додано», рис. 4.4 ТЗ):
 * «Сьогодні», «Вчора» або дата у форматі `дд.мм.рррр`.
 * @param {string|Date} value - дата додавання (ISO-рядок з API).
 * @param {Date} [now=new Date()] - поточний момент.
 * @returns {string} текст для відображення; для некоректної дати — порожній рядок.
 */
export function formatAddedAt(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days === 0) return i18n.t('common.today');
  if (days === 1) return i18n.t('common.yesterday');
  return date.toLocaleDateString(i18n.language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Скорочений ідентифікатор треку для адмін-панелі: перші 8 символів UUID (замість `TRK-001` з рис. 4.5 ТЗ).
 * @param {string} id - UUID.
 * @returns {string} перші 8 символів.
 */
export function shortId(id) {
  return String(id).slice(0, 8);
}

/**
 * Назва настрою для відображення: у БД настрої зберігаються з малої літери, у інтерфейсі — з великої.
 * @param {string} mood - значення зі словника MOODS.
 * @returns {string} напр. «Спокійний».
 */
export function displayMood(mood) {
  return mood ? mood.charAt(0).toLocaleUpperCase('uk') + mood.slice(1) : '';
}
