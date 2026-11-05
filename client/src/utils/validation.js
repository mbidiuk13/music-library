/**
 * @module utils/validation
 * @description Клієнтська валідація форм. Правила дублюють серверні (modules/auth/password.rules.js,
 * modules/auth/auth.routes.js, modules/media/media.routes.js), щоб помилку було видно ще до
 * надсилання запиту (UC-1: кнопка неактивна, поле підсвічується червоним). Сервер усе одно
 * перевіряє дані повторно — клієнтська валідація лише для зручності.
 *
 * Кожен валідатор повертає ключ i18n повідомлення про помилку або null, якщо значення коректне.
 * Числові межі для повідомлень — у LIMITS (передаються в `t(key, LIMITS)`).
 */

/** Межі довжини полів (як у схемі БД і серверних правилах). */
export const LIMITS = Object.freeze({
  passwordMin: 10,
  passwordMax: 64,
  emailMax: 255,
  usernameMax: 100,
  queryMax: 100,
});

/** Дозволені символи пароля: друковані ASCII-символи без пробілу (коди 0x21–0x7E). */
const PASSWORD_ALLOWED = /^[\x21-\x7E]*$/;
const HAS_LETTER = /[A-Za-z]/;
const HAS_DIGIT = /[0-9]/;
const HAS_SPECIAL = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

/** Спрощена перевірка формату email: щось@домен.зона, без пробілів. */
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Перевіряє поле «Електронна пошта» форми реєстрації чи відновлення пароля.
 * @param {string} email - введене значення.
 * @returns {string|null} ключ i18n помилки або null.
 */
export function validateEmail(email) {
  const value = email.trim();
  if (!value) return 'validation.email.required';
  if (value.length > LIMITS.emailMax) return 'validation.email.tooLong';
  if (!EMAIL_FORMAT.test(value)) return 'validation.email.invalid';
  return null;
}

/**
 * Перевіряє поле «Ім'я» (1–100 символів після обрізання пробілів).
 * @param {string} username - введене значення.
 * @returns {string|null} ключ i18n помилки або null.
 */
export function validateUsername(username) {
  const value = username.trim();
  if (!value) return 'validation.username.required';
  if (value.length > LIMITS.usernameMax) return 'validation.username.tooLong';
  return null;
}

/**
 * Перевіряє обов'язкове поле без додаткових правил (напр. пароль у формі входу).
 * @param {string} value - введене значення.
 * @param {string} key - ключ i18n помилки для порожнього поля.
 * @returns {string|null} ключ i18n помилки або null.
 */
export function validateRequired(value, key) {
  return value.trim() ? null : key;
}

/**
 * Окремі вимоги до пароля (FR-2) — для підказки-чеклиста під полем.
 * @param {string} password - введений пароль.
 * @returns {{key: string, isMet: boolean}[]} вимоги з позначкою, чи виконано кожну.
 */
export function passwordRequirements(password) {
  return [
    {
      key: 'validation.password.ruleLength',
      isMet: password.length >= LIMITS.passwordMin && password.length <= LIMITS.passwordMax,
    },
    { key: 'validation.password.ruleLetter', isMet: HAS_LETTER.test(password) },
    { key: 'validation.password.ruleDigit', isMet: HAS_DIGIT.test(password) },
    { key: 'validation.password.ruleSpecial', isMet: HAS_SPECIAL.test(password) },
  ];
}

/**
 * Перевіряє новий пароль за правилами FR-2 (у тому самому порядку, що й сервер):
 * наявність → набір символів → довжина 10–64 → латинська літера → цифра → спецсимвол.
 * @param {string} password - введений пароль.
 * @returns {string|null} ключ i18n помилки або null.
 */
export function validateNewPassword(password) {
  if (!password) return 'validation.password.required';
  if (!PASSWORD_ALLOWED.test(password)) return 'validation.password.charset';
  if (password.length < LIMITS.passwordMin || password.length > LIMITS.passwordMax) {
    return 'validation.password.length';
  }
  if (!HAS_LETTER.test(password)) return 'validation.password.letter';
  if (!HAS_DIGIT.test(password)) return 'validation.password.digit';
  if (!HAS_SPECIAL.test(password)) return 'validation.password.special';
  return null;
}

/**
 * Перевіряє, що повтор пароля збігається з паролем.
 * @param {string} password - пароль.
 * @param {string} passwordConfirm - повтор пароля.
 * @returns {string|null} ключ i18n помилки або null.
 */
export function validatePasswordConfirm(password, passwordConfirm) {
  if (!passwordConfirm) return 'validation.passwordConfirm.required';
  if (password !== passwordConfirm) return 'validation.passwordConfirm.mismatch';
  return null;
}

/**
 * Перевіряє пошуковий запит (UC-3): порожній запит не надсилається, довжина ≤ 100 символів.
 * @param {string} query - введений запит.
 * @returns {string|null} ключ i18n помилки або null.
 */
export function validateSearchQuery(query) {
  const value = query.trim();
  if (!value) return 'validation.search.required';
  if (value.length > LIMITS.queryMax) return 'validation.search.tooLong';
  return null;
}
