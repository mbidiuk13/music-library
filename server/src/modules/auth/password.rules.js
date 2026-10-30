/**
 * @module modules/auth/password.rules
 * @description Правила надійності пароля (FR-2, тест 1.1 розділу 4 ПЗ):
 * довжина 10–64 символи; лише латинські літери, цифри та спецсимволи (друковані ASCII без пробілу);
 * щонайменше одна латинська літера, одна цифра й один спецсимвол.
 * Ті самі правила дублюються на клієнті.
 */

/** Мінімальна і максимальна довжина пароля. */
export const PASSWORD_LENGTH = Object.freeze({ min: 10, max: 64 });

/** Дозволені символи: друковані ASCII-символи без пробілу (коди 0x21–0x7E). */
const ALLOWED_CHARS = /^[\x21-\x7E]*$/;
const HAS_LETTER = /[A-Za-z]/;
const HAS_DIGIT = /[0-9]/;
const HAS_SPECIAL = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

/** Повідомлення про порушення правил (показуються користувачу). */
export const PASSWORD_MESSAGES = Object.freeze({
  required: 'Введіть пароль',
  charset: 'Пароль може містити лише латинські літери, цифри та спеціальні символи',
  length: `Пароль має містити від ${PASSWORD_LENGTH.min} до ${PASSWORD_LENGTH.max} символів`,
  letter: 'Пароль має містити хоча б одну латинську літеру',
  digit: 'Пароль має містити хоча б одну цифру',
  special: 'Пароль має містити хоча б один спеціальний символ',
});

/**
 * Перевіряє пароль за всіма правилами й повертає перше порушення.
 * Порядок перевірок: наявність → набір символів → довжина → класи символів.
 * @param {unknown} password - значення поля «Пароль» з тіла запиту.
 * @returns {string|null} повідомлення про помилку українською або null, якщо пароль надійний.
 */
export function checkPassword(password) {
  if (typeof password !== 'string' || password === '') return PASSWORD_MESSAGES.required;
  if (!ALLOWED_CHARS.test(password)) return PASSWORD_MESSAGES.charset;
  if (password.length < PASSWORD_LENGTH.min || password.length > PASSWORD_LENGTH.max) {
    return PASSWORD_MESSAGES.length;
  }
  if (!HAS_LETTER.test(password)) return PASSWORD_MESSAGES.letter;
  if (!HAS_DIGIT.test(password)) return PASSWORD_MESSAGES.digit;
  if (!HAS_SPECIAL.test(password)) return PASSWORD_MESSAGES.special;
  return null;
}
