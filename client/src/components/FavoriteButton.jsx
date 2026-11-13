import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFavorites } from '../context/FavoritesContext.jsx';
import Icon from './Icon.jsx';

export default function FavoriteButton({ trackId }) {
  const { t } = useTranslation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isBusy, setIsBusy] = useState(false);
  const active = isFavorite(trackId);

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
