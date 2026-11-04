/**
 * @module components/FavoriteButton
 * @description Кнопка-сердечко: додає трек до плейлиста «Улюблені» або прибирає з нього.
 * Показується лише авторизованим користувачам.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addFavorite, fetchFavoriteIds, removeFavorite } from '../api/favorites.js';
import Icon from './Icon.jsx';

/**
 * Сердечко для треку.
 * @param {object} props - властивості.
 * @param {string} props.trackId - UUID треку.
 * @returns {JSX.Element} кнопка.
 */
export default function FavoriteButton({ trackId }) {
  const { t } = useTranslation();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // З'ясовуємо, чи трек уже в «Улюблених». Для іншого треку батьківський компонент
  // перемонтовує кнопку (key={trackId}), тож стан починається з false.
  useEffect(() => {
    const controller = new AbortController();
    fetchFavoriteIds(controller.signal)
      .then(({ ids }) => setIsFavorite(ids.includes(trackId)))
      .catch(() => {});
    return () => controller.abort();
  }, [trackId]);

  /**
   * Перемикає стан «улюблений» (оптимістично; у разі помилки повертає попередній стан).
   * 409 під час додавання і 404 під час видалення означають, що стан уже потрібний.
   * @returns {Promise<void>}
   */
  const handleClick = async () => {
    const nextValue = !isFavorite;
    setIsFavorite(nextValue);
    setIsBusy(true);
    try {
      if (nextValue) await addFavorite(trackId);
      else await removeFavorite(trackId);
    } catch (err) {
      const alreadyDone = nextValue ? err.status === 409 : err.status === 404;
      if (!alreadyDone) setIsFavorite(!nextValue);
    } finally {
      setIsBusy(false);
    }
  };

  const label = t(isFavorite ? 'player.removeFavorite' : 'player.addFavorite');
  return (
    <button
      type="button"
      className={isFavorite ? 'icon-button favorite favorite--active' : 'icon-button favorite'}
      onClick={handleClick}
      disabled={isBusy}
      aria-pressed={isFavorite}
      aria-label={label}
      title={label}
    >
      <Icon name="heart" outline={!isFavorite} />
    </button>
  );
}
