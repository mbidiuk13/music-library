/**
 * @module components/TrackList
 * @description Список треків (Топ-100 на рис. 4.2, результати пошуку на рис. 4.3): номер, обкладинка,
 * назва й виконавець, жанр, ♥ (лише авторизованим) і кнопка Play. Натискання Play відтворює трек
 * через PlayerContext, а весь список стає чергою відтворення.
 */

import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { usePlayer } from '../context/PlayerContext.jsx';
import { coverGradient } from '../utils/cover.js';
import FavoriteButton from './FavoriteButton.jsx';
import Icon from './Icon.jsx';

/**
 * Рядок списку треків.
 * @param {object} props - властивості.
 * @param {object} props.track - трек `{id, title, artist, genre, …}`.
 * @param {number} props.position - порядковий номер (з 1).
 * @param {boolean} props.isCurrent - чи це поточний трек плеєра.
 * @param {boolean} props.isPlaying - чи грає зараз поточний трек.
 * @param {boolean} props.showFavorite - чи показувати сердечко.
 * @param {() => void} props.onPlay - відтворення / пауза.
 * @returns {JSX.Element} рядок.
 */
function TrackRow({ track, position, isCurrent, isPlaying, showFavorite, onPlay }) {
  const { t } = useTranslation();
  const playLabel = t(isCurrent && isPlaying ? 'player.pause' : 'tracks.playTrack', {
    title: track.title,
  });
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
      <span className="track-row__actions">
        {showFavorite && <FavoriteButton trackId={track.id} />}
      </span>
    </li>
  );
}

/**
 * Нумерований список треків.
 * @param {object} props - властивості.
 * @param {object[]} props.tracks - треки.
 * @param {string} props.label - доступна назва списку (для програм читання з екрана).
 * @returns {JSX.Element} список.
 */
export default function TrackList({ tracks, label }) {
  const { isAuthenticated } = useAuth();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  return (
    <ol className="track-list" aria-label={label}>
      {tracks.map((track, index) => (
        <TrackRow
          key={track.id}
          track={track}
          position={index + 1}
          isCurrent={currentTrack?.id === track.id}
          isPlaying={isPlaying}
          showFavorite={isAuthenticated}
          onPlay={() => playTrack(track, tracks)}
        />
      ))}
    </ol>
  );
}
