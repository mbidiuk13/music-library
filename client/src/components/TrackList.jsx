/**
 * @module components/TrackList
 * @description Список треків (Топ-100 на рис. 4.2, результати пошуку на рис. 4.3, треки плейлиста
 * на рис. 4.4): номер, обкладинка, назва й виконавець, жанр, ♥ (лише авторизованим) і кнопка Play.
 * Натискання Play відтворює трек через PlayerContext, а весь список стає чергою відтворення.
 * У варіанті для плейлиста є рядок заголовків, колонка «Додано» і дія «Прибрати з плейлиста».
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { usePlayer } from '../context/PlayerContext.jsx';
import { coverGradient } from '../utils/cover.js';
import { formatAddedAt } from '../utils/format.js';
import FavoriteButton from './FavoriteButton.jsx';
import Icon from './Icon.jsx';

/**
 * Рядок списку треків.
 * @param {object} props - властивості.
 * @param {object} props.track - трек `{id, title, artist, genre, added_at?, …}`.
 * @param {number} props.position - порядковий номер (з 1).
 * @param {boolean} props.isCurrent - чи це поточний трек плеєра.
 * @param {boolean} props.isPlaying - чи грає зараз поточний трек.
 * @param {boolean} props.showFavorite - чи показувати сердечко.
 * @param {boolean} props.showAddedAt - чи показувати дату додавання до плейлиста.
 * @param {() => void} props.onPlay - відтворення / пауза.
 * @param {(() => Promise<void>)|undefined} props.onRemove - вилучення з плейлиста (якщо дія доступна).
 * @returns {JSX.Element} рядок.
 */
function TrackRow({
  track,
  position,
  isCurrent,
  isPlaying,
  showFavorite,
  showAddedAt,
  onPlay,
  onRemove,
}) {
  const { t } = useTranslation();
  const [isRemoving, setIsRemoving] = useState(false);
  const playLabel = t(isCurrent && isPlaying ? 'player.pause' : 'tracks.playTrack', {
    title: track.title,
  });
  const removeLabel = t('tracks.removeFromPlaylist', { title: track.title });

  /**
   * Вилучає трек; поки запит виконується, кнопка неактивна. Після успіху рядок прибирає
   * батьківський компонент, тому стан скидається лише у разі помилки.
   * @returns {Promise<void>}
   */
  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemove();
    } catch {
      setIsRemoving(false);
    }
  };

  return (
    <li className={isCurrent ? 'track-row track-row--current' : 'track-row'}>
      <span className="track-row__position">{position}</span>
      <button
        type="button"
        className="track-row__cover"
        style={{ background: coverGradient(track.id) }}
        onClick={onPlay}
        aria-label={playLabel}
        title={playLabel}
      >
        <Icon name={isCurrent && isPlaying ? 'pause' : 'play'} size={22} />
      </button>
      <span className="track-row__meta">
        <span className="track-row__title" title={track.title}>
          {track.title}
        </span>
        <span className="track-row__artist" title={track.artist}>
          {track.artist}
        </span>
      </span>
      <span className="track-row__genre">{track.genre}</span>
      {showAddedAt && (
        <span className="track-row__added">
          <span className="visually-hidden">{t('tracks.columns.added')}: </span>
          {formatAddedAt(track.added_at)}
        </span>
      )}
      <span className="track-row__actions">
        {showFavorite && <FavoriteButton trackId={track.id} />}
        {onRemove && (
          <button
            type="button"
            className="icon-button icon-button--danger"
            onClick={handleRemove}
            disabled={isRemoving}
            aria-label={removeLabel}
            title={removeLabel}
          >
            <Icon name="remove" />
          </button>
        )}
      </span>
    </li>
  );
}

/**
 * Нумерований список треків.
 * @param {object} props - властивості.
 * @param {object[]} props.tracks - треки.
 * @param {string} props.label - доступна назва списку (для програм читання з екрана).
 * @param {'default'|'playlist'} [props.variant='default'] - звичайний список або таблиця треків плейлиста.
 * @param {boolean} [props.showFavorite] - показувати сердечка (за замовчуванням — авторизованим).
 * @param {(track: object) => Promise<void>} [props.onRemove] - вилучення треку з плейлиста.
 * @returns {JSX.Element} список.
 */
export default function TrackList({ tracks, label, variant = 'default', showFavorite, onRemove }) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const isPlaylist = variant === 'playlist';
  return (
    <div className={isPlaylist ? 'track-table track-table--playlist' : 'track-table'}>
      {isPlaylist && (
        <div className="track-row track-row--head" aria-hidden="true">
          <span className="track-row__position">#</span>
          <span className="track-row__head-title">{t('tracks.columns.title')}</span>
          <span>{t('tracks.columns.genre')}</span>
          <span>{t('tracks.columns.added')}</span>
          <span className="track-row__actions">{t('tracks.columns.actions')}</span>
        </div>
      )}
      <ol className="track-list" aria-label={label}>
        {tracks.map((track, index) => (
          <TrackRow
            key={track.id}
            track={track}
            position={index + 1}
            isCurrent={currentTrack?.id === track.id}
            isPlaying={isPlaying}
            showFavorite={showFavorite ?? isAuthenticated}
            showAddedAt={isPlaylist}
            onPlay={() => playTrack(track, tracks)}
            onRemove={onRemove && (() => onRemove(track))}
          />
        ))}
      </ol>
    </div>
  );
}
