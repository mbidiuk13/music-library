import i18n from '../i18n/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatTime(seconds) {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}

//«Сьогодні», «Вчора» або дата дд.мм.рррр (колонка «Додано»)
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

export function shortId(id) {
  return String(id).slice(0, 8);
}

export function displayMood(mood) {
  return mood ? mood.charAt(0).toLocaleUpperCase(i18n.language) + mood.slice(1) : '';
}
