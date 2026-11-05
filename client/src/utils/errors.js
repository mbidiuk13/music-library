/**
 * @module utils/errors
 * @description Перетворення помилок API на повідомлення для користувача.
 */

import i18n from '../i18n/index.js';

/**
 * Повертає зрозуміле повідомлення про помилку запиту.
 * Порядок: власний текст для відомого коду помилки (`errors.codes.<CODE>` в uk.json) →
 * повідомлення сервера (українською) → загальне «Щось пішло не так».
 * @param {unknown} error - помилка (зазвичай ApiError).
 * @returns {string} текст повідомлення.
 */
export function errorMessage(error) {
  const code = error?.code;
  const codeKey = `errors.codes.${code}`;
  if (code && i18n.exists(codeKey)) return i18n.t(codeKey);
  if (error?.message) return error.message;
  return i18n.t('errors.generic');
}
