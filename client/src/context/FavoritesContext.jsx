/**
 * @module context/FavoritesContext
 * @description Спільний стан плейлиста «Улюблені» для кнопок-сердечок: множина id улюблених треків
 * завантажується один раз на сесію (`GET /api/favorites/ids`), а не окремо для кожного рядка списку.
 * Тому сердечко в плеєрі та в списках треків завжди показує однаковий стан.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { addFavorite, fetchFavoriteIds, removeFavorite } from '../api/favorites.js';
import { useAuth } from './AuthContext.jsx';

/**
 * @typedef {object} FavoritesContextValue
 * @property {(trackId: string) => boolean} isFavorite - чи трек у «Улюблених».
 * @property {(trackId: string) => Promise<void>} toggleFavorite - додати трек або прибрати його.
 * @property {(trackId: string, value: boolean) => void} markFavorite - оновити лише локальний стан,
 *   коли трек додано до «Улюблених» чи прибрано з них іншим запитом (медіатека, «Додати до плейлиста»).
 */

const FavoritesContext = createContext(/** @type {FavoritesContextValue|null} */ (null));

/** Порожня множина для гостя (спільний екземпляр, щоб не перемальовувати споживачів). */
const EMPTY_IDS = new Set();

/**
 * Провайдер «Улюблених». Має бути всередині AuthProvider.
 * @param {{children: import('react').ReactNode}} props - дочірні елементи.
 * @returns {JSX.Element} провайдер контексту.
 */
export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Множина належить конкретному користувачу: після виходу чи зміни акаунта вона не показується.
  const [state, setState] = useState({ userId: null, ids: EMPTY_IDS });
  const ids = state.userId === userId ? state.ids : EMPTY_IDS;
  const idsRef = useRef(ids);
  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);

  // Завантаження id улюблених треків для поточного користувача.
  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    fetchFavoriteIds(controller.signal)
      .then((data) => setState({ userId, ids: new Set(data.ids) }))
      .catch(() => {});
    return () => controller.abort();
  }, [userId]);

  /**
   * Позначає трек як улюблений або знімає позначку (лише локально).
   * @param {string} trackId - UUID треку.
   * @param {boolean} value - нове значення.
   * @returns {void}
   */
  const markFavorite = useCallback(
    (trackId, value) => {
      const next = new Set(idsRef.current);
      if (value) next.add(trackId);
      else next.delete(trackId);
      idsRef.current = next;
      setState({ userId, ids: next });
    },
    [userId],
  );

  /**
   * Перемикає стан «улюблений» (оптимістично; у разі помилки повертає попередній стан).
   * 409 під час додавання і 404 під час видалення означають, що стан на сервері вже потрібний.
   * @param {string} trackId - UUID треку.
   * @returns {Promise<void>}
   */
  const toggleFavorite = useCallback(
    async (trackId) => {
      const nextValue = !idsRef.current.has(trackId);
      markFavorite(trackId, nextValue);
      try {
        if (nextValue) await addFavorite(trackId);
        else await removeFavorite(trackId);
      } catch (err) {
        const alreadyDone = nextValue ? err.status === 409 : err.status === 404;
        if (!alreadyDone) markFavorite(trackId, !nextValue);
      }
    },
    [markFavorite],
  );

  const isFavorite = useCallback((trackId) => ids.has(trackId), [ids]);

  const value = useMemo(
    () => ({ isFavorite, toggleFavorite, markFavorite }),
    [isFavorite, toggleFavorite, markFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

/**
 * Хук доступу до «Улюблених».
 * @returns {FavoritesContextValue} значення контексту.
 * @throws {Error} якщо викликано поза FavoritesProvider.
 */
export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used within FavoritesProvider');
  return context;
}
