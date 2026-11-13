import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth.js';
import { getToken, setToken, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(/** @type {object|null} */ (null));

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (getToken() ? 'loading' : 'ready'));
  const [sessionError, setSessionError] = useState(/** @type {unknown} */ (null));
  const [sessionAttempt, setSessionAttempt] = useState(0);

  //JWT stateless: щоб завершити сесію, достатньо забути токен (UC-8)
  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

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
        //401 токен прострочений або недійсний, продовжуємо як гість. Інші помилки (сервер
        //недоступний), токен не видаляємо, а пропонуємо повторити спробу
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

  const retrySession = useCallback(() => {
    setSessionError(null);
    setStatus('loading');
    setSessionAttempt((value) => value + 1);
  }, []);

  //якщо будь-який запит отримав 401 на збережений токен, сесія закінчилась
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const startSession = useCallback(({ token, user: sessionUser }) => {
    setToken(token);
    setUser(sessionUser);
    setStatus('ready');
    return sessionUser;
  }, []);

  const login = useCallback(
    async (credentials) => startSession(await authApi.login(credentials)),
    [startSession],
  );

  //за постумовою UC-1 після реєстрації, сторінка входу, тож токен не зберігається
  const register = useCallback(async (data) => (await authApi.register(data)).user, []);

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
