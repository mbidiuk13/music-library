import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { usePlayer } from '../context/PlayerContext.jsx';
import { coverGradient } from '../utils/cover.js';
import { formatAddedAt } from '../utils/format.js';
import AddToPlaylistDialog from './AddToPlaylistDialog.jsx';
import FavoriteButton from './FavoriteButton.jsx';
import Icon from './Icon.jsx';

function TrackRow({
  track,
  position,
  isCurrent,
  isPlaying,
  showFavorite,
  canAddToPlaylist,
  showAddedAt,
  onPlay,
  onAddToPlaylist,
  onRemove,
}) {
  const { t } = useTranslation();
  const [isRemoving, setIsRemoving] = useState(false);
  const playLabel = t(isCurrent && isPlaying ? 'player.pause' : 'tracks.playTrack', {
    title: track.title,
  });
  const removeLabel = t('tracks.removeFromPlaylist', { title: track.title });
  const addLabel = t('tracks.addToPlaylist', { title: track.title });

  //після успіху рядок прибирає батьківський компонент, тому стан скидається лише у разі помилки
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
        {canAddToPlaylist && (
          <button
            type="button"
            className="icon-button"
            onClick={onAddToPlaylist}
            aria-haspopup="dialog"
            aria-label={addLabel}
            title={addLabel}
          >
            <Icon name="playlistAdd" />
          </button>
        )}
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

export default function TrackList({
  tracks,
  label,
  variant = 'default',
  showFavorite,
  onRemove,
  onAddedToPlaylist,
}) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const [pickerTrack, setPickerTrack] = useState(/** @type {object|null} */ (null));
  const isPlaylist = variant === 'playlist';
  return (
    <div className={isPlaylist ? 'track-table track-table--playlist' : 'track-table'}>
      {isPlaylist && (
        <div className="track-row track-row--head" aria-hidden="true">
          <span className="track-row__position">{t('tracks.columns.position')}</span>
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
            canAddToPlaylist={isAuthenticated}
            showAddedAt={isPlaylist}
            onPlay={() => playTrack(track, tracks)}
            onAddToPlaylist={() => setPickerTrack(track)}
            onRemove={onRemove && (() => onRemove(track))}
          />
        ))}
      </ol>
      {pickerTrack && (
        <AddToPlaylistDialog
          track={pickerTrack}
          onClose={() => setPickerTrack(null)}
          onAdded={onAddedToPlaylist}
        />
      )}
    </div>
  );
}
