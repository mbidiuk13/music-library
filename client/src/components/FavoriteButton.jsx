/**
 * @module components/FavoriteButton
 * @description Кнопка-сердечко: додає трек до плейлиста «Улюблені» або прибирає з нього.
 * Стан береться зі спільного FavoritesContext. Показується лише авторизованим користувачам.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFavorites } from '../context/FavoritesContext.jsx';
import Icon from './Icon.jsx';

/**
 * Сердечко для треку.
 * @param {object} props - властивості.
 * @param {string} props.trackId - UUID треку.
 * @returns {JSX.Element} кнопка.
 */
export default function FavoriteButton({ trackId }) {
  const { t } = useTranslation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isBusy, setIsBusy] = useState(false);
  const active = isFavorite(trackId);

  /**
   * Перемикає стан «улюблений»; поки запит виконується, кнопка неактивна.
   * @returns {Promise<void>}
   */
  const handleClick = async () => {
    setIsBusy(true);
    try {
      await toggleFavorite(trackId);
    } finally {
      setIsBusy(false);
    }
  };

  const label = t(active ? 'player.removeFavorite' : 'player.addFavorite');
  return (
    <button
      type="button"
      className={active ? 'icon-button favorite favorite--active' : 'icon-button favorite'}
      onClick={handleClick}
      disabled={isBusy}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      <Icon name="heart" outline={!active} />
    </button>
  );
}
