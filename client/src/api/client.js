const TOKEN_KEY = 'musiclibrary.token';
const API_PREFIX = '/api';
let unauthorizedHandler = null;

//status 0 мережа недоступна; details подробиці помилок валідації
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

//тіло-об'єкт надсилається як JSON, FormData як multipart; для 204 повертає null
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
  /*сервер API завжди відповідає JSON. Помилка 5xx без JSON-тіла означає, що запит не дійшов 
  до сервера (проксі Vite чи nginx не може з'єднатися з ним), для користувача це «немає зв'язку»*/
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
