/**
 * @module context/PlayerContext
 * @description Стан і керування аудіоплеєром. Провайдер рендерить **єдиний** елемент `<audio>`
 * і розташований над маршрутами (у main.jsx), тому перехід між сторінками не перериває відтворення.
 *
 * Відтворення треку: `GET /api/tracks/:id/stream` → `audio.src = url` → на першу подію
 * `playing` — `POST /api/tracks/:id/play`. Якщо посилання прострочилось (S3 відповідає 403,
 * що для `<audio>` виглядає як звичайна помилка завантаження), посилання перезапитується
 * один раз; повторна помилка — повідомлення «Помилка відтворення аудіозапису» (UC-7).
 *
 * Поточна позиція й тривалість винесені в окремий контекст (usePlayerProgress), щоб
 * подія `timeupdate` (кілька разів на секунду) не перемальовувала всі компоненти зі списками треків.
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
import { getStreamUrl, registerPlay } from '../api/tracks.js';
import { useAuth } from './AuthContext.jsx';

/** Ключ localStorage для збереженої гучності. */
const VOLUME_KEY = 'musiclibrary.volume';

/** Гучність за замовчуванням (0…1). */
const DEFAULT_VOLUME = 0.8;

/** Якщо від початку треку минуло більше секунд — «Попередній» перемотує на початок. */
const PREV_RESTART_THRESHOLD = 3;

/** Запас часу (мс), з яким посилання вважається простроченим ще до фактичного кінця строку дії. */
const URL_EXPIRY_MARGIN_MS = 30_000;

/**
 * @typedef {object} Track
 * @property {string} id - UUID треку.
 * @property {string} title - назва.
 * @property {string} artist - виконавець.
 */

/**
 * @typedef {object} PlayerContextValue
 * @property {Track[]} queue - черга відтворення.
 * @property {number} currentIndex - індекс поточного треку в черзі (-1 — нічого не обрано).
 * @property {Track|null} currentTrack - поточний трек.
 * @property {boolean} isPlaying - чи грає зараз музика.
 * @property {boolean} isLoading - чи завантажується аудіо.
 * @property {number} volume - гучність 0…1.
 * @property {string|null} error - ключ i18n повідомлення про помилку або null.
 * @property {boolean} hasNext - чи є наступний трек у черзі.
 * @property {boolean} hasPrev - чи є попередній трек у черзі.
 * @property {(track: Track, queue?: Track[]) => void} playTrack - відтворити трек (і задати чергу).
 * @property {() => void} toggle - пауза / продовження.
 * @property {() => void} next - наступний трек.
 * @property {() => void} prev - попередній трек або на початок поточного.
 * @property {(time: number) => void} seek - перемотати на позицію (секунди).
 * @property {(volume: number) => void} setVolume - змінити гучність.
 */

const PlayerContext = createContext(/** @type {PlayerContextValue|null} */ (null));

const PlayerProgressContext = createContext(
  /** @type {{currentTime: number, duration: number}|null} */ (null),
);

/**
 * Читає збережену гучність з localStorage.
 * @returns {number} гучність 0…1.
 */
function readStoredVolume() {
  const stored = Number.parseFloat(localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : DEFAULT_VOLUME;
}

/**
 * Провайдер плеєра. Має бути всередині AuthProvider і поза `<Routes>`.
 * @param {{children: import('react').ReactNode}} props - дочірні елементи.
 * @returns {JSX.Element} провайдер контексту з елементом `<audio>`.
 */
export function PlayerProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const audioRef = useRef(/** @type {HTMLAudioElement|null} */ (null));

  const [queue, setQueue] = useState(/** @type {Track[]} */ ([]));
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(readStoredVolume);
  const [error, setError] = useState(/** @type {string|null} */ (null));

  // Актуальні черга й індекс для обробників подій <audio> (без перестворення підписок).
  // Оновлюються разом зі станом у loadTrack, playTrack і stop.
  const queueRef = useRef(queue);
  const indexRef = useRef(currentIndex);

  /** Номер останнього завантаження: відповіді для попередніх треків ігноруються. */
  const loadIdRef = useRef(0);
  /** Чи вже надіслано POST /play для поточного завантаження треку. */
  const playReportedRef = useRef(false);
  /** Чи вже використано повторний запит посилання після помилки. */
  const retriedRef = useRef(false);
  /** Момент (мс), після якого pre-signed посилання вважається простроченим. */
  const urlExpiresAtRef = useRef(0);

  /**
   * Завантажує трек з черги: запитує pre-signed посилання й запускає відтворення.
   * @param {Track[]} nextQueue - черга.
   * @param {number} index - індекс треку в черзі.
   * @param {object} [options] - параметри.
   * @param {number} [options.startAt=0] - позиція (с), з якої почати.
   * @param {boolean} [options.isRetry=false] - повторне завантаження того самого треку (нове посилання).
   * @returns {Promise<void>}
   */
  const loadTrack = useCallback(async (nextQueue, index, { startAt = 0, isRetry = false } = {}) => {
    const audio = audioRef.current;
    const track = nextQueue[index];
    if (!audio || !track) return;

    const loadId = ++loadIdRef.current;
    queueRef.current = nextQueue;
    indexRef.current = index;
    setQueue(nextQueue);
    setCurrentIndex(index);
    setError(null);
    setIsLoading(true);
    if (!isRetry) {
      playReportedRef.current = false;
      retriedRef.current = false;
      setCurrentTime(0);
      setDuration(0);
    }

    let stream;
    try {
      stream = await getStreamUrl(track.id);
    } catch {
      if (loadId !== loadIdRef.current) return;
      setIsLoading(false);
      setIsPlaying(false);
      setError('player.errors.playback');
      return;
    }
    if (loadId !== loadIdRef.current) return;

    urlExpiresAtRef.current = Date.now() + stream.expiresIn * 1000 - URL_EXPIRY_MARGIN_MS;
    audio.src = stream.url;
    if (startAt > 0) audio.currentTime = startAt;
    try {
      await audio.play();
    } catch (err) {
      if (loadId !== loadIdRef.current) return;
      // AbortError — відтворення перервано новим src; інші помилки обробить подія `error`.
      if (err.name === 'NotAllowedError') {
        setIsLoading(false);
        setIsPlaying(false);
      }
    }
  }, []);

  /**
   * Зупиняє відтворення і очищає чергу (використовується під час виходу з акаунту).
   * @returns {void}
   */
  const stop = useCallback(() => {
    const audio = audioRef.current;
    loadIdRef.current += 1;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    queueRef.current = [];
    indexRef.current = -1;
    setQueue([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
  }, []);

  /**
   * Відтворює трек. Якщо передано чергу — вона стає поточною (наступні треки грають автоматично).
   * Повторне натискання на поточний трек ставить його на паузу або продовжує.
   * @param {Track} track - трек.
   * @param {Track[]} [trackQueue] - список, з якого обрано трек (напр. Топ-100 або плейлист).
   * @returns {void}
   */
  const playTrack = useCallback(
    (track, trackQueue) => {
      let nextQueue = trackQueue?.length ? trackQueue : [track];
      let index = nextQueue.findIndex((item) => item.id === track.id);
      if (index === -1) {
        nextQueue = [track];
        index = 0;
      }

      const current = queueRef.current[indexRef.current];
      const audio = audioRef.current;
      if (current?.id === track.id && audio?.getAttribute('src')) {
        queueRef.current = nextQueue;
        indexRef.current = index;
        setQueue(nextQueue);
        setCurrentIndex(index);
        if (audio.paused) audio.play().catch(() => {});
        else audio.pause();
        return;
      }
      loadTrack(nextQueue, index);
    },
    [loadTrack],
  );

  /**
   * Пауза / продовження поточного треку. Якщо посилання вже прострочене — запитує нове
   * й продовжує з тієї самої позиції.
   * @returns {void}
   */
  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || indexRef.current < 0) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (!audio.getAttribute('src') || Date.now() > urlExpiresAtRef.current) {
      loadTrack(queueRef.current, indexRef.current, {
        startAt: audio.currentTime,
        isRetry: Boolean(audio.getAttribute('src')),
      });
      return;
    }
    audio.play().catch(() => {});
  }, [loadTrack]);

  /**
   * Перехід до наступного треку черги (нічого не робить на останньому).
   * @returns {void}
   */
  const next = useCallback(() => {
    const nextIndex = indexRef.current + 1;
    if (nextIndex < queueRef.current.length) loadTrack(queueRef.current, nextIndex);
  }, [loadTrack]);

  /**
   * Перехід до попереднього треку; якщо поточний грає довше кількох секунд
   * або він перший у черзі — перемотування на початок.
   * @returns {void}
   */
  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || indexRef.current < 0) return;
    if (audio.currentTime > PREV_RESTART_THRESHOLD || indexRef.current === 0) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    loadTrack(queueRef.current, indexRef.current - 1);
  }, [loadTrack]);

  /**
   * Перемотує поточний трек.
   * @param {number} time - позиція в секундах.
   * @returns {void}
   */
  const seek = useCallback((time) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const clamped = Math.min(Math.max(time, 0), audio.duration);
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  /**
   * Змінює гучність і запам'ятовує її в localStorage.
   * @param {number} value - гучність 0…1.
   * @returns {void}
   */
  const setVolume = useCallback((value) => {
    const clamped = Math.min(Math.max(value, 0), 1);
    setVolumeState(clamped);
    localStorage.setItem(VOLUME_KEY, String(clamped));
  }, []);

  // Гучність елемента <audio> слідує за станом.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Підписка на події елемента <audio>.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    /** Трек реально почав грати: фіксуємо відтворення (один раз на завантаження). */
    const handlePlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
      retriedRef.current = false;
      const track = queueRef.current[indexRef.current];
      if (track && !playReportedRef.current) {
        playReportedRef.current = true;
        registerPlay(track.id).catch(() => {});
      }
    };
    /** Пауза (зокрема автоматична в кінці треку). */
    const handlePause = () => setIsPlaying(false);
    /** Буферизація під час відтворення. */
    const handleWaiting = () => setIsLoading(true);
    /** Оновлення позиції. */
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    /** Відома тривалість треку. */
    const handleDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    /** Кінець треку: автоматично наступний. */
    const handleEnded = () => next();
    /** Помилка завантаження: один раз перезапитуємо посилання, далі — повідомлення. */
    const handleError = () => {
      if (!audio.getAttribute('src') || indexRef.current < 0) return;
      if (!retriedRef.current) {
        retriedRef.current = true;
        loadTrack(queueRef.current, indexRef.current, {
          startAt: audio.currentTime,
          isRetry: true,
        });
        return;
      }
      setIsLoading(false);
      setIsPlaying(false);
      setError('player.errors.playback');
    };

    const listeners = {
      playing: handlePlaying,
      pause: handlePause,
      waiting: handleWaiting,
      timeupdate: handleTimeUpdate,
      durationchange: handleDuration,
      loadedmetadata: handleDuration,
      ended: handleEnded,
      error: handleError,
    };
    Object.entries(listeners).forEach(([event, handler]) => audio.addEventListener(event, handler));
    return () =>
      Object.entries(listeners).forEach(([event, handler]) =>
        audio.removeEventListener(event, handler),
      );
  }, [next, loadTrack]);

  // Вихід з акаунту зупиняє музику: користувач опиняється на сторінці привітання.
  const wasAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticatedRef.current && !isAuthenticated) stop();
    wasAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated, stop]);

  const currentTrack = queue[currentIndex] ?? null;

  const value = useMemo(
    () => ({
      queue,
      currentIndex,
      currentTrack,
      isPlaying,
      isLoading,
      volume,
      error,
      hasNext: currentIndex >= 0 && currentIndex < queue.length - 1,
      hasPrev: currentIndex >= 0,
      playTrack,
      toggle,
      next,
      prev,
      seek,
      setVolume,
    }),
    [
      queue,
      currentIndex,
      currentTrack,
      isPlaying,
      isLoading,
      volume,
      error,
      playTrack,
      toggle,
      next,
      prev,
      seek,
      setVolume,
    ],
  );

  const progress = useMemo(() => ({ currentTime, duration }), [currentTime, duration]);

  return (
    <PlayerContext.Provider value={value}>
      <PlayerProgressContext.Provider value={progress}>
        {children}
        <audio ref={audioRef} preload="auto" />
      </PlayerProgressContext.Provider>
    </PlayerContext.Provider>
  );
}

/**
 * Хук доступу до стану й дій плеєра.
 * @returns {PlayerContextValue} значення контексту.
 * @throws {Error} якщо викликано поза PlayerProvider.
 */
export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
}

/**
 * Хук доступу до позиції й тривалості поточного треку (оновлюється кілька разів на секунду).
 * @returns {{currentTime: number, duration: number}} позиція і тривалість у секундах.
 * @throws {Error} якщо викликано поза PlayerProvider.
 */
export function usePlayerProgress() {
  const context = useContext(PlayerProgressContext);
  if (!context) throw new Error('usePlayerProgress must be used within PlayerProvider');
  return context;
}
