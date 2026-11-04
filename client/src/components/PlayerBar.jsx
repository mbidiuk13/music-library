/**
 * @module components/PlayerBar
 * @description Нижня панель плеєра (макети рис. 4.2–4.5 ТЗ): обкладинка-градієнт,
 * назва й виконавець, ♥ (лише авторизованим), ⏮ ▶/⏸ ⏭, прогрес-бар із перемотуванням,
 * час і гучність. Стан і дії — з PlayerContext.
 */

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { usePlayer, usePlayerProgress } from '../context/PlayerContext.jsx';
import { coverGradient } from '../utils/cover.js';
import { formatTime } from '../utils/format.js';
import FavoriteButton from './FavoriteButton.jsx';
import Icon from './Icon.jsx';

/** Крок зміни гучності повзунком. */
const VOLUME_STEP = 0.01;

/**
 * Обчислює відсоток заповнення смуги (для градієнтної заливки повзунка).
 * @param {number} value - поточне значення.
 * @param {number} max - максимальне значення.
 * @returns {string} відсоток у форматі CSS, напр. `42%`.
 */
function fillPercent(value, max) {
  return `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`;
}

/**
 * Прогрес-бар з поточним часом і тривалістю. Окремий компонент, бо оновлюється
 * кілька разів на секунду, — решта панелі при цьому не перемальовується.
 * @param {{disabled: boolean, onSeek: (time: number) => void}} props - властивості.
 * @returns {JSX.Element} смуга прогресу.
 */
function ProgressBar({ disabled, onSeek }) {
  const { t } = useTranslation();
  const { currentTime, duration } = usePlayerProgress();
  return (
    <div className="player__progress">
      <span className="player__time">{formatTime(currentTime)}</span>
      <input
        type="range"
        className="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        onChange={(event) => onSeek(Number(event.target.value))}
        disabled={disabled || !duration}
        aria-label={t('player.progress')}
        aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
        style={{ '--fill': fillPercent(currentTime, duration) }}
      />
      <span className="player__time">{formatTime(duration)}</span>
    </div>
  );
}

/**
 * Нижня панель плеєра.
 * @returns {JSX.Element} панель плеєра.
 */
export default function PlayerBar() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const {
    currentTrack,
    isPlaying,
    isLoading,
    volume,
    error,
    hasNext,
    hasPrev,
    toggle,
    next,
    prev,
    seek,
    setVolume,
  } = usePlayer();

  // Гучність до вимкнення звуку — щоб повернути її кнопкою.
  const volumeBeforeMuteRef = useRef(volume || 0.8);

  /**
   * Вимикає звук або повертає попередню гучність.
   * @returns {void}
   */
  const toggleMute = () => {
    if (volume > 0) {
      volumeBeforeMuteRef.current = volume;
      setVolume(0);
    } else {
      setVolume(volumeBeforeMuteRef.current || 0.8);
    }
  };

  const hasTrack = Boolean(currentTrack);
  const playLabel = t(isPlaying ? 'player.pause' : 'player.play');

  return (
    <footer className="player" aria-label={t('player.label')}>
      <div className="player__track">
        {hasTrack ? (
          <>
            <span
              className="player__cover"
              style={{ background: coverGradient(currentTrack.id) }}
              aria-hidden="true"
            />
            <span className="player__meta">
              <span className="player__title" title={currentTrack.title}>
                {currentTrack.title}
              </span>
              {error ? (
                <span className="player__error" role="alert">
                  {t(error)}
                </span>
              ) : (
                <span className="player__artist" title={currentTrack.artist}>
                  {currentTrack.artist}
                </span>
              )}
            </span>
            {isAuthenticated && <FavoriteButton key={currentTrack.id} trackId={currentTrack.id} />}
          </>
        ) : (
          <>
            <span className="player__cover player__cover--empty" aria-hidden="true">
              <Icon name="music" />
            </span>
            <span className="player__hint">{t('player.empty')}</span>
          </>
        )}
      </div>

      <div className="player__center">
        <div className="player__controls">
          <button
            type="button"
            className="icon-button"
            onClick={prev}
            disabled={!hasPrev}
            aria-label={t('player.prev')}
            title={t('player.prev')}
          >
            <Icon name="prev" />
          </button>
          <button
            type="button"
            className={isLoading ? 'player__play player__play--loading' : 'player__play'}
            onClick={toggle}
            disabled={!hasTrack}
            aria-label={playLabel}
            title={playLabel}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={22} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={next}
            disabled={!hasNext}
            aria-label={t('player.next')}
            title={t('player.next')}
          >
            <Icon name="next" />
          </button>
        </div>
        <ProgressBar disabled={!hasTrack} onSeek={seek} />
      </div>

      <div className="player__volume">
        <button
          type="button"
          className="icon-button"
          onClick={toggleMute}
          aria-label={t(volume > 0 ? 'player.mute' : 'player.unmute')}
          title={t(volume > 0 ? 'player.mute' : 'player.unmute')}
        >
          <Icon name={volume > 0 ? 'volume' : 'volumeMute'} />
        </button>
        <input
          type="range"
          className="range"
          min={0}
          max={1}
          step={VOLUME_STEP}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          aria-label={t('player.volume')}
          style={{ '--fill': fillPercent(volume, 1) }}
        />
      </div>
    </footer>
  );
}
