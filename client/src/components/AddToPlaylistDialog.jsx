/**
 * @module components/AddToPlaylistDialog
 * @description Дія «Додати до плейлиста» (UC-4, FR-10, BPMN рис. 1.4): вікно зі списком плейлистів
 * користувача і формою «Новий плейлист». Вибір наявного плейлиста додає до нього трек
 * (`POST /api/playlists/:id/tracks`); створення нового плейлиста одразу з цим треком виконується
 * одним запитом в одній транзакції (`POST /api/playlists/with-track`). Список плейлистів
 * завантажується разом з ознакою `hasTrack` (`GET /api/playlists?trackId=`), тож плейлисти, де трек
 * уже є, одразу позначені «Уже є». Успіх показується toast-сповіщенням і позначкою «Додано» біля
 * плейлиста; помилки сервера (трек уже в плейлисті, назва зайнята) — зрозумілим текстом у вікні.
 * Вікно лишається відкритим, тож трек можна додати ще в кілька плейлистів.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addTrackToPlaylist, createPlaylistWithTrack, fetchPlaylists } from '../api/playlists.js';
import { useFavorites } from '../context/FavoritesContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useForm from '../hooks/useForm.js';
import useRequest from '../hooks/useRequest.js';
import { coverGradient } from '../utils/cover.js';
import { errorMessage } from '../utils/errors.js';
import { LIMITS, validatePlaylistTitle } from '../utils/validation.js';
import FormField from './FormField.jsx';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import { RequestError, TrackListSkeleton } from './RequestState.jsx';

/**
 * Валідація форми нового плейлиста.
 * @param {{title: string}} values - значення поля.
 * @returns {{title: string|null}} ключ i18n помилки.
 */
function validateNewPlaylist(values) {
  return { title: validatePlaylistTitle(values.title) };
}

/** Початкові значення форми нового плейлиста. */
const NEW_PLAYLIST_VALUES = Object.freeze({ title: '' });

/**
 * Форма «Новий плейлист» з цим треком. Після успіху батьківський компонент перемонтовує її (key),
 * щоб очистити поле.
 * @param {object} props - властивості.
 * @param {(title: string) => Promise<void>} props.onCreate - створення плейлиста з треком.
 * @param {(busy: boolean) => void} props.onBusyChange - повідомляє, що виконується запит.
 * @returns {JSX.Element} форма.
 */
function NewPlaylistForm({ onCreate, onBusyChange }) {
  const { t } = useTranslation();
  const { values, isValid, handleChange, handleBlur, fieldError, setServerErrors, touchAll } =
    useForm(NEW_PLAYLIST_VALUES, validateNewPlaylist);
  const [isBusy, setIsBusy] = useState(false);

  /**
   * Надсилає форму. Зайнята назва (409) показується під полем.
   * @param {import('react').FormEvent<HTMLFormElement>} event - подія надсилання.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    touchAll();
    if (!isValid || isBusy) return;
    setIsBusy(true);
    onBusyChange(true);
    try {
      await onCreate(values.title.trim());
    } catch (err) {
      setServerErrors([{ field: 'title', message: errorMessage(err) }]);
      setIsBusy(false);
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <form className="picker__create" onSubmit={handleSubmit} noValidate>
      <FormField
        name="title"
        label={t('addToPlaylist.newPlaylist')}
        placeholder={t('playlists.titlePlaceholder')}
        maxLength={LIMITS.playlistTitleMax}
        autoComplete="off"
        value={values.title}
        onChange={handleChange}
        onBlur={handleBlur}
        error={fieldError('title')}
      />
      <button type="submit" className="btn-secondary" disabled={!isValid || isBusy}>
        <Icon name="plus" />
        {t(isBusy ? 'library.creating' : 'addToPlaylist.createAndAdd')}
      </button>
    </form>
  );
}

/**
 * Вікно «Додати до плейлиста».
 * @param {object} props - властивості.
 * @param {object} props.track - трек `{id, title, artist}`.
 * @param {() => void} props.onClose - закриття вікна.
 * @param {(playlist: object, info: {created: boolean}) => void} [props.onAdded] - трек додано
 *   до плейлиста (наприклад, щоб оновити лічильник на картці в медіатеці).
 * @returns {JSX.Element} модальне вікно.
 */
export default function AddToPlaylistDialog({ track, onClose, onAdded }) {
  const { t } = useTranslation();
  const { markFavorite } = useFavorites();
  const { showToast } = useToast();
  // Плейлисти з ознакою hasTrack. Стан «сердечка» узгоджується з тим, чи є трек в «Улюблених»
  // на сервері (його могли додати чи прибрати в іншій вкладці).
  const load = useMemo(
    () => async (signal) => {
      const result = await fetchPlaylists(signal, track.id);
      const favorites = result.playlists.find((playlist) => playlist.is_favorites);
      if (favorites) markFavorite(track.id, favorites.hasTrack);
      return result;
    },
    [track.id, markFavorite],
  );
  const { data, error, isLoading, reload } = useRequest(load);
  const [created, setCreated] = useState(/** @type {object[]} */ ([]));
  const [statuses, setStatuses] = useState(
    /** @type {Record<string, 'busy'|'added'|'exists'>} */ ({}),
  );
  const [message, setMessage] = useState(/** @type {string|null} */ (null));
  const [formKey, setFormKey] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  const playlists = data ? [...data.playlists, ...created] : [];
  const isBusy = isCreating || Object.values(statuses).includes('busy');

  /**
   * Поточний стан плейлиста у списку: дія користувача в цьому вікні, інакше — «Уже є»,
   * якщо сервер повідомив, що трек уже в плейлисті.
   * @param {{id: string, hasTrack?: boolean}} playlist - плейлист.
   * @returns {'busy'|'added'|'exists'|undefined} стан.
   */
  const statusOf = (playlist) =>
    statuses[playlist.id] ?? (playlist.hasTrack ? 'exists' : undefined);

  /**
   * Змінює стан одного плейлиста у списку.
   * @param {string} id - UUID плейлиста.
   * @param {'busy'|'added'|'exists'|undefined} status - новий стан.
   * @returns {void}
   */
  const setStatus = (id, status) => setStatuses((prev) => ({ ...prev, [id]: status }));

  /**
   * Додає трек до наявного плейлиста. Якщо трек уже там (409), показує це замість помилки.
   * @param {object} playlist - обраний плейлист.
   * @returns {Promise<void>}
   */
  const handleAdd = async (playlist) => {
    setStatus(playlist.id, 'busy');
    setMessage(null);
    try {
      await addTrackToPlaylist(playlist.id, track.id);
      setStatus(playlist.id, 'added');
      showToast(t('addToPlaylist.added', { track: track.title, title: playlist.title }));
      if (playlist.is_favorites) markFavorite(track.id, true);
      onAdded?.(playlist, { created: false });
    } catch (err) {
      if (err.code === 'TRACK_ALREADY_IN_PLAYLIST') {
        setStatus(playlist.id, 'exists');
        setMessage(t('addToPlaylist.alreadyIn', { title: playlist.title }));
        if (playlist.is_favorites) markFavorite(track.id, true);
      } else {
        setStatus(playlist.id, undefined);
        setMessage(errorMessage(err));
      }
    }
  };

  /**
   * Створює новий плейлист з цим треком (одна транзакція на сервері).
   * @param {string} title - назва нового плейлиста.
   * @returns {Promise<void>}
   * @throws {import('../api/client.js').ApiError} помилка сервера (показується під полем).
   */
  const handleCreate = async (title) => {
    setMessage(null);
    const { playlist } = await createPlaylistWithTrack(title, track.id);
    setCreated((prev) => [...prev, playlist]);
    setStatus(playlist.id, 'added');
    showToast(t('addToPlaylist.created', { track: track.title, title: playlist.title }));
    setFormKey((key) => key + 1);
    onAdded?.(playlist, { created: true });
  };

  return (
    <Modal title={t('addToPlaylist.title')} onClose={onClose} isBusy={isBusy} size="md">
      <p className="picker__track">
        <span
          className="picker__track-cover"
          style={{ background: coverGradient(track.id) }}
          aria-hidden="true"
        />
        <span className="picker__track-meta">
          <span className="picker__track-title">{track.title}</span>
          <span className="picker__track-artist">{track.artist}</span>
        </span>
      </p>

      <div aria-live="polite">
        {message && (
          <p className="notice notice--error" role="alert">
            {message}
          </p>
        )}
      </div>

      {isLoading && <TrackListSkeleton rows={3} />}
      {error && <RequestError error={error} onRetry={reload} />}
      {data && (
        <ul className="picker__list" aria-label={t('addToPlaylist.chooseLabel')}>
          {playlists.map((playlist) => {
            const status = statusOf(playlist);
            const isDone = status === 'added' || status === 'exists';
            return (
              <li key={playlist.id}>
                <button
                  type="button"
                  className={isDone ? 'picker__item picker__item--done' : 'picker__item'}
                  onClick={() => handleAdd(playlist)}
                  disabled={status === 'busy' || isDone}
                >
                  <span
                    className={
                      playlist.is_favorites
                        ? 'picker__cover picker__cover--favorites'
                        : 'picker__cover'
                    }
                    style={
                      playlist.is_favorites ? undefined : { background: coverGradient(playlist.id) }
                    }
                    aria-hidden="true"
                  >
                    <Icon name={playlist.is_favorites ? 'heart' : 'queue'} size={18} />
                  </span>
                  <span className="picker__name">{playlist.title}</span>
                  <span className="picker__state">
                    {status === 'busy' && t('addToPlaylist.adding')}
                    {status === 'added' && (
                      <>
                        <Icon name="check" size={16} />
                        {t('addToPlaylist.stateAdded')}
                      </>
                    )}
                    {status === 'exists' && t('addToPlaylist.stateExists')}
                    {!status && (
                      <>
                        <Icon name="plus" size={16} />
                        {t('addToPlaylist.add')}
                      </>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <NewPlaylistForm key={formKey} onCreate={handleCreate} onBusyChange={setIsCreating} />

      <div className="modal__actions">
        <button type="button" className="btn-outline" onClick={onClose} disabled={isBusy}>
          {t('addToPlaylist.done')}
        </button>
      </div>
    </Modal>
  );
}
