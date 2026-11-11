/**
 * @module utils/navigation
 * @description Допоміжні функції для стану навігації react-router між сторінками.
 */

/**
 * Стан навігації для переходу між входом і відновленням пароля: введена пошта
 * передається через state маршрутизатора (не через URL), лише якщо поле не порожнє.
 * Сторінка призначення читає її з `location.state?.email`.
 * @param {string} email - значення поля пошти.
 * @returns {{email: string}|undefined} стан навігації або undefined, якщо поле порожнє.
 */
export function emailState(email) {
  const trimmed = email.trim();
  return trimmed ? { email: trimmed } : undefined;
}
