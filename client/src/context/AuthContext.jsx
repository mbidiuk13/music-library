/**
 * @module context/AuthContext
 * @description Стан автентифікації клієнта: поточний користувач, вхід, реєстрація, вихід (UC-8)
 * і відновлення сесії після перезавантаження сторінки через `GET /api/auth/me`. Якщо сервер
 * недоступний, сесія не скидається: стан 'error' і повтор запиту кнопкою «Спробувати ще раз».
 * Токен зберігається в localStorage (див. api/client.js).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth.js';
import { getToken, setToken, setUnauthorizedHandler } from '../api/client.js';

/**
 * @typedef {object} AuthUser
 * @property {string} id - UUID користувача.
 * @property {string} email - пошта.
 * @property {string} username - ім'я.
 * @property {'user'|'admin'} role - роль (RBAC).
 */

/**
 * @typedef {object} AuthContextValue
 * @property {AuthUser|null} user - поточний користувач або null для гостя.
 * @property {'loading'|'ready'|'error'} status - 'loading', поки відновлюється сесія за збереженим
 *   токеном; 'error' — відновити сесію не вдалося (напр. немає зв'язку із сервером).
 * @property {unknown} sessionError - помилка відновлення сесії (для стану 'error').
 * @property {() => void} retrySession - повторити відновлення сесії.
 * @property {boolean} isAuthenticated - чи увійшов користувач.
 * @property {boolean} isAdmin - чи має користувач роль адміністратора.
 * @property {(credentials: {email: string, password: string}) => Promise<AuthUser>} login - вхід.
 * @property {(data: object) => Promise<AuthUser>} register - реєстрація (без автоматичного входу, UC-1).
 * @property {() => void} logout - вихід: видаляє токен і переходить на сторінку привітання.
 */

const AuthContext = createContext(/** @type {AuthContextValue|null} */ (null));

/**
 * Провайдер стану автентифікації. Має бути всередині BrowserRouter (використовує навігацію).
 * @param {{children: import('react').ReactNode}} props - дочірні елементи.
 * @returns {JSX.Element} провайдер контексту.
 */
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (getToken() ? 'loading' : 'ready'));
  const [sessionError, setSessionError] = useState(/** @type {unknown} */ (null));
  /** Номер спроби відновлення сесії (кнопка «Спробувати ще раз» запускає нову). */
  const [sessionAttempt, setSessionAttempt] = useState(0);

  /**
   * Завершує сесію локально: JWT stateless, тож достатньо забути токен (UC-8).
   * @returns {void}
   */
  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Відновлення сесії: якщо токен є — запитуємо дані користувача.
  useEffect(() => {
    if (!getToken()) return undefined;
    const controller = new AbortController();
    authApi
      .fetchMe(controller.signal)
      .then(({ user: me }) => {
        setUser(me);
        setStatus('ready');
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        // 401 — токен прострочений або недійсний: продовжуємо як гість. Інші помилки (сервер
        // недоступний) — токен не видаляємо, а пропонуємо повторити спробу.
        if (err.status === 401) {
          clearSession();
          setStatus('ready');
        } else {
          setSessionError(err);
          setStatus('error');
        }
      });
    return () => controller.abort();
  }, [clearSession, sessionAttempt]);

  /**
   * Повторює відновлення сесії після помилки (кнопка «Спробувати ще раз»).
   * @returns {void}
   */
  const retrySession = useCallback(() => {
    setSessionError(null);
    setStatus('loading');
    setSessionAttempt((value) => value + 1);
  }, []);

  // Якщо будь-який запит отримав 401 на збережений токен — сесія закінчилась.
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  /**
   * Зберігає токен і користувача після успішного входу чи реєстрації.
   * @param {{token: string, user: AuthUser}} session - відповідь сервера.
   * @returns {AuthUser} користувач.
   */
  const startSession = useCallback(({ token, user: sessionUser }) => {
    setToken(token);
    setUser(sessionUser);
    setStatus('ready');
    return sessionUser;
  }, []);

  /**
   * Вхід за поштою і паролем (UC-2).
   * @param {{email: string, password: string}} credentials - дані форми входу.
   * @returns {Promise<AuthUser>} користувач, що увійшов.
   * @throws {import('../api/client.js').ApiError} 401 «Невірний логін або пароль» тощо.
   */
  const login = useCallback(
    async (credentials) => startSession(await authApi.login(credentials)),
    [startSession],
  );

  /**
   * Реєстрація (UC-1). За постумовою UC-1 користувач після реєстрації переходить на сторінку
   * входу, тому токен з відповіді сервера не зберігається — сесія починається лише після входу.
   * @param {object} data - дані форми реєстрації.
   * @returns {Promise<AuthUser>} новий користувач.
   * @throws {import('../api/client.js').ApiError} помилки валідації, 409 — пошта зайнята.
   */
  const register = useCallback(async (data) => (await authApi.register(data)).user, []);

  /**
   * Вихід з акаунту (UC-8): анулює токен на клієнті й веде на сторінку привітання.
   * @returns {void}
   */
  const logout = useCallback(() => {
    clearSession();
    navigate('/welcome', { replace: true });
  }, [clearSession, navigate]);

  const value = useMemo(
    () => ({
      user,
      status,
      sessionError,
      retrySession,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      login,
      register,
      logout,
    }),
    [user, status, sessionError, retrySession, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Хук доступу до стану автентифікації.
 * @returns {AuthContextValue} значення контексту.
 * @throws {Error} якщо викликано поза AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
