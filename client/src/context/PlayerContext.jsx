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

const VOLUME_KEY = 'musiclibrary.volume';
const DEFAULT_VOLUME = 0.8;
const PREV_RESTART_THRESHOLD = 3;
const URL_EXPIRY_MARGIN_MS = 30_000;

const PlayerContext = createContext(/** @type {object|null} */ (null));

//позиція в окремому контексті: timeupdate (кілька разів на секунду) не перемальовує списки
const PlayerProgressContext = createContext(
  /** @type {{currentTime: number, duration: number}|null} */ (null),
);

function readStoredVolume() {
  const stored = Number.parseFloat(localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : DEFAULT_VOLUME;
}

export function PlayerProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const audioRef = useRef(/** @type {HTMLAudioElement|null} */ (null));

  const [queue, setQueue] = useState(/** @type {object[]} */ ([]));
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(readStoredVolume);
  const [error, setError] = useState(/** @type {string|null} */ (null));

  //актуальні черга й індекс для обробників подій <audio> (без перестворення підписок)
  const queueRef = useRef(queue);
  const indexRef = useRef(currentIndex);

  //номер останнього завантаження, відповіді для попередніх треків ігноруються
  const loadIdRef = useRef(0);
  const playReportedRef = useRef(false);
  const retriedRef = useRef(false);
  const urlExpiresAtRef = useRef(0);

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
      //AbortError — відтворення перервано новим src; інші помилки обробить подія `error`
      if (err.name === 'NotAllowedError') {
        setIsLoading(false);
        setIsPlaying(false);
      }
    }
  }, []);

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

  //повторне натискання на поточний трек ставить його на паузу або продовжує
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

  //якщо посилання вже прострочене, запитує нове й продовжує з тієї самої позиції
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

  const next = useCallback(() => {
    const nextIndex = indexRef.current + 1;
    if (nextIndex < queueRef.current.length) loadTrack(queueRef.current, nextIndex);
  }, [loadTrack]);

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

  const seek = useCallback((time) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const clamped = Math.min(Math.max(time, 0), audio.duration);
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const setVolume = useCallback((value) => {
    const clamped = Math.min(Math.max(value, 0), 1);
    setVolumeState(clamped);
    localStorage.setItem(VOLUME_KEY, String(clamped));
  }, []);

  const updateTrackInfo = useCallback((track) => {
    if (!queueRef.current.some((item) => item.id === track.id)) return;
    const nextQueue = queueRef.current.map((item) =>
      item.id === track.id ? { ...item, ...track } : item,
    );
    queueRef.current = nextQueue;
    setQueue(nextQueue);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    /*прослуховування фіксується на першу подію `playing` (трек реально почав грати),
    а не на клік чи завантаження, і лише один раз на завантаження треку*/
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
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handleEnded = () => next();
    /*прострочене посилання S3 (403) для <audio> виглядає як помилка завантаження:
    посилання перезапитується один раз, повторна помилка — повідомлення (UC-7)*/
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

  //вихід з акаунту зупиняє музику: користувач опиняється на сторінці привітання
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
      updateTrackInfo,
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
      updateTrackInfo,
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

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
}

export function usePlayerProgress() {
  const context = useContext(PlayerProgressContext);
  if (!context) throw new Error('usePlayerProgress must be used within PlayerProvider');
  return context;
}
