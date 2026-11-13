//множина id «Улюблених» завантажується раз на сесію, а не окремо для кожного сердечка
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

const FavoritesContext = createContext(/** @type {object|null} */ (null));

//спільний екземпляр для гостя, щоб не перемальовувати споживачів
const EMPTY_IDS = new Set();

export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  //множина належить конкретному користувачу: після виходу чи зміни акаунта вона не показується
  const [state, setState] = useState({ userId: null, ids: EMPTY_IDS });
  const ids = state.userId === userId ? state.ids : EMPTY_IDS;
  const idsRef = useRef(ids);
  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);

  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    fetchFavoriteIds(controller.signal)
      .then((data) => setState({ userId, ids: new Set(data.ids) }))
      .catch(() => {});
    return () => controller.abort();
  }, [userId]);

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

  //оптимістично; 409 під час додавання чи 404 під час видалення, стан на сервері вже потрібний
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

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used within FavoritesProvider');
  return context;
}
