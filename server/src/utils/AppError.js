/**
 * @module utils/AppError
 * @description Клас прикладної помилки з HTTP-статусом і машиночитним кодом.
 * Такі помилки централізовано перетворюються на JSON-відповідь у middleware errorHandler.
 */

/**
 * Помилка, яку можна безпечно показати клієнту.
 * @extends Error
 */
export default class AppError extends Error {
  /**
   * Створює прикладну помилку.
   * @param {number} status - HTTP-статус відповіді (400, 401, 403, 404, 409, …).
   * @param {string} code - машиночитний код помилки, напр. `VALIDATION_ERROR`.
   * @param {string} message - зрозуміле повідомлення українською.
   * @param {Array<object>} [details] - додаткові відомості (напр. помилки окремих полів).
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
