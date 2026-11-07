/**
 * @module api/client
 * @description Обгортка над fetch для звернень до REST API (`/api/*`).
 * Додає заголовок `Authorization: Bearer <JWT>`, розбирає JSON і перетворює
 * відповідь з помилкою (`{ error: { code, message, details } }`) на виняток ApiError.
 * Токен зберігається в localStorage і передається лише в заголовку (без cookies).
 */

/** Ключ, під яким токен доступу зберігається в localStorage. */
const TOKEN_KEY = 'musiclibrary.token';

/** Базовий префікс REST API (у розробці Vite проксіює його на сервер Express). */
const API_PREFIX = '/api';

/** Обробник відповіді 401 на запит з токеном (токен прострочений або недійсний). */
let unauthorizedHandler = null;

/**
 * Помилка звернення до API з HTTP-статусом і кодом помилки сервера.
 */
export class ApiError extends Error {
  /**
   * @param {number} status - HTTP-статус відповіді (0 — мережа недоступна).
   * @param {string} code - машинний код помилки (`VALIDATION_ERROR`, `UNAUTHORIZED`, …).
   * @param {string} message - повідомлення для користувача (українською, з сервера).
   * @param {Array<object>} [details] - подробиці помилок валідації.
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Повертає збережений токен доступу.
 * @returns {string|null} JWT або null, якщо користувач не входив.
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Зберігає токен доступу або видаляє його (якщо передано null).
 * @param {string|null} token - JWT або null.
 * @returns {void}
 */
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * Реєструє обробник, який викликається, коли сервер відхилив збережений токен (401).
 * AuthContext використовує його, щоб завершити сесію.
 * @param {(() => void)|null} handler - функція-обробник або null, щоб зняти реєстрацію.
 * @returns {void}
 */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

/**
 * Виконує запит до API.
 * @param {string} path - шлях після `/api`, напр. `/auth/me`.
 * @param {object} [options] - параметри запиту.
 * @param {string} [options.method='GET'] - HTTP-метод.
 * @param {object|FormData} [options.body] - тіло: об'єкт надсилається як JSON, FormData — як multipart.
 * @param {AbortSignal} [options.signal] - сигнал для скасування запиту.
 * @returns {Promise<any>} розібране тіло відповіді (null для 204).
 * @throws {ApiError} якщо сервер повернув помилку або мережа чи сервер недоступні (`NETWORK_ERROR`).
 */
export async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, { method, headers, body: payload, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', '');
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  // Сервер API завжди відповідає JSON. Помилка 5xx без JSON-тіла означає, що запит не дійшов
  // до сервера (проксі Vite чи nginx не може з'єднатися з ним) — для користувача це «немає зв'язку».
  if (!response.ok && data === null && response.status >= 500) {
    throw new ApiError(response.status, 'NETWORK_ERROR', '');
  }
  if (!response.ok) {
    if (response.status === 401 && token && unauthorizedHandler) unauthorizedHandler();
    const error = data?.error ?? {};
    throw new ApiError(
      response.status,
      error.code ?? 'HTTP_ERROR',
      error.message ?? '',
      error.details,
    );
  }
  return data;
}
