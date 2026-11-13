import i18n from '../i18n/index.js';

//пріоритет: текст для коду помилки (errors.codes.<CODE>) → повідомлення сервера → загальне
export function errorMessage(error) {
  const code = error?.code;
  const codeKey = `errors.codes.${code}`;
  if (code && i18n.exists(codeKey)) return i18n.t(codeKey);
  if (error?.message) return error.message;
  return i18n.t('errors.generic');
}
