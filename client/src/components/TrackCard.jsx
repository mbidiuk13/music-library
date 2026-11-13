import { useTranslation } from 'react-i18next';
import { coverGradient } from '../utils/cover.js';
import Icon from './Icon.jsx';

export default function TrackCard({ track, isCurrent, isPlaying, onPlay }) {
  const { t } = useTranslation();
  const playLabel = t(isCurrent && isPlaying ? 'player.pause' : 'tracks.playTrack', {
    title: track.title,
  });
  const hasSimilarity = typeof track.similarity === 'number';
  return (
    <li className={isCurrent ? 'track-card track-card--current' : 'track-card'}>
      <button
        type="button"
        className="track-card__cover"
        style={{ background: coverGradient(track.id) }}
        onClick={onPlay}
        aria-label={playLabel}
        title={playLabel}
      >
        <span className="track-card__play">
          <Icon name={isCurrent && isPlaying ? 'pause' : 'play'} size={22} />
        </span>
      </button>
      <span className="track-card__title" title={track.title}>
        {track.title}
      </span>
      <span className="track-card__artist" title={track.artist}>
        {track.artist}
      </span>
      {hasSimilarity && (
        <span className="track-card__similarity" title={t('home.similarityHint')}>
          {t('home.similarity', { value: Math.round(track.similarity * 100) })}
        </span>
      )}
    </li>
  );
}
