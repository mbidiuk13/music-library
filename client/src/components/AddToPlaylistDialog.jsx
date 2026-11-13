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

function validateNewPlaylist(values) {
  return { title: validatePlaylistTitle(values.title) };
}

const NEW_PLAYLIST_VALUES = Object.freeze({ title: '' });

//після успіху батьківський компонент перемонтовує форму (key), щоб очистити поле
function NewPlaylistForm({ onCreate, onBusyChange }) {
  const { t } = useTranslation();
  const { values, isValid, handleChange, handleBlur, fieldError, setServerErrors, touchAll } =
    useForm(NEW_PLAYLIST_VALUES, validateNewPlaylist);
  const [isBusy, setIsBusy] = useState(false);

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

export default function AddToPlaylistDialog({ track, onClose, onAdded }) {
  const { t } = useTranslation();
  const { markFavorite } = useFavorites();
  const { showToast } = useToast();
  //сердечко узгоджується із сервером, трек могли додати в «Улюблені» чи прибрати в іншій вкладці
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

  const statusOf = (playlist) =>
    statuses[playlist.id] ?? (playlist.hasTrack ? 'exists' : undefined);

  const setStatus = (id, status) => setStatuses((prev) => ({ ...prev, [id]: status }));

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
