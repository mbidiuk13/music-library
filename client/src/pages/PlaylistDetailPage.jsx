/**
 * @module pages/PlaylistDetailPage
 * @description Треки обраного плейлиста (нижня частина рис. 4.4 ТЗ, маршрут `/playlists/:id`):
 * таблиця «# / Назва / Жанр / Додано / Дії» з відтворенням і вилученням треку, а також
 * перейменування й видалення плейлиста (UC-11, FR-12). Для «Улюблених» перейменування
 * й видалення недоступні (сервер теж їх забороняє — 403). Чужий або видалений плейлист — 404.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  deletePlaylist,
  fetchPlaylist,
  removeTrackFromPlaylist,
  renamePlaylist,
} from '../api/playlists.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Icon from '../components/Icon.jsx';
import PlaylistTitleDialog from '../components/PlaylistTitleDialog.jsx';
import { EmptyState, RequestError, TrackListSkeleton } from '../components/RequestState.jsx';
import TrackList from '../components/TrackList.jsx';
import { useFavorites } from '../context/FavoritesContext.jsx';
import useRequest from '../hooks/useRequest.js';
import { errorMessage } from '../utils/errors.js';

/**
 * Сторінка плейлиста (вкладена в PlaylistsPage).
 * @returns {JSX.Element} панель з треками плейлиста.
 */
export default function PlaylistDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  /** @type {import('./PlaylistsPage.jsx').LibraryOutletContext} */
  const { updatePlaylists } = useOutletContext();
  const { markFavorite } = useFavorites();

  const load = useMemo(() => (signal) => fetchPlaylist(id, signal), [id]);
  const { data, error, isLoading, reload } = useRequest(load);

  // Локальні зміни (перейменування, вилучені треки) належать конкретній відповіді сервера.
  const [edits, setEdits] = useState({ data: null, playlist: null, tracks: null });
  const current = edits.data === data && edits.playlist ? edits : data;
  const playlist = current?.playlist;
  const tracks = current?.tracks;

  const [dialog, setDialog] = useState(/** @type {'rename'|'delete'|null} */ (null));
  const [actionError, setActionError] = useState(/** @type {unknown} */ (null));

  /**
   * Змінює плейлист і/або треки локально, без повторного завантаження.
   * @param {(state: {playlist: object, tracks: object[]}) => {playlist: object, tracks: object[]}} update -
   *   функція оновлення.
   * @returns {void}
   */
  const updateLocal = (update) =>
    setEdits((prev) => {
      const base = prev.data === data && prev.playlist ? prev : data;
      return { data, ...update({ playlist: base.playlist, tracks: base.tracks }) };
    });

  /**
   * Вилучає трек з плейлиста (UC-11). Якщо трека в плейлисті вже немає (404), рядок теж прибирається.
   * @param {object} track - трек.
   * @returns {Promise<void>}
   * @throws {import('../api/client.js').ApiError} інша помилка (кнопка рядка знову стає активною).
   */
  const handleRemove = async (track) => {
    setActionError(null);
    try {
      await removeTrackFromPlaylist(id, track.id);
    } catch (err) {
      if (err.code !== 'TRACK_NOT_IN_PLAYLIST') {
        setActionError(err);
        throw err;
      }
    }
    updateLocal(({ playlist: list, tracks: items }) => ({
      playlist: { ...list, track_count: Math.max(0, list.track_count - 1) },
      tracks: items.filter((item) => item.id !== track.id),
    }));
    updatePlaylists((list) =>
      list.map((item) =>
        item.id === id ? { ...item, track_count: Math.max(0, item.track_count - 1) } : item,
      ),
    );
    if (playlist.is_favorites) markFavorite(track.id, false);
  };

  /**
   * Перейменовує плейлист (UC-11).
   * @param {string} title - нова назва.
   * @returns {Promise<void>}
   * @throws {import('../api/client.js').ApiError} помилка сервера (показується у формі).
   */
  const handleRename = async (title) => {
    const { playlist: renamed } = await renamePlaylist(id, title);
    updateLocal((state) => ({ ...state, playlist: { ...state.playlist, title: renamed.title } }));
    updatePlaylists((list) =>
      list.map((item) => (item.id === id ? { ...item, title: renamed.title } : item)),
    );
    setDialog(null);
  };

  /**
   * Видаляє плейлист (UC-11) і повертає до списку плейлистів.
   * @returns {Promise<void>}
   * @throws {import('../api/client.js').ApiError} помилка сервера (показується у вікні).
   */
  const handleDelete = async () => {
    await deletePlaylist(id);
    updatePlaylists((list) => list.filter((item) => item.id !== id));
    navigate('/playlists', { replace: true });
  };

  if (isLoading) {
    return (
      <section className="library-panel" aria-busy="true">
        <TrackListSkeleton rows={4} />
      </section>
    );
  }

  if (error) {
    return (
      <section className="library-panel">
        {error.status === 404 || error.status === 400 ? (
          <div className="state-message" role="status">
            <p className="state-message__title">{t('library.notFound')}</p>
            <Link to="/playlists" className="btn-secondary">
              {t('library.backToPlaylists')}
            </Link>
          </div>
        ) : (
          <RequestError error={error} onRetry={reload} />
        )}
      </section>
    );
  }

  if (!playlist) return null;

  const heading = t('library.tracksIn', { title: playlist.title });

  return (
    <section className="library-panel" aria-labelledby="playlist-title">
      <header className="library-panel__head">
        <h2 id="playlist-title" className="library-panel__title">
          <Icon name="queue" size={24} className="library-panel__icon" />
          <span>{heading}</span>
        </h2>
        {!playlist.is_favorites && (
          <div className="library-panel__actions">
            <button type="button" className="btn-outline" onClick={() => setDialog('rename')}>
              <Icon name="edit" size={18} />
              {t('library.rename')}
            </button>
            <button
              type="button"
              className="btn-danger-outline"
              onClick={() => setDialog('delete')}
            >
              <Icon name="trash" size={18} />
              {t('library.delete')}
            </button>
          </div>
        )}
      </header>

      {actionError && (
        <p className="notice notice--error" role="alert">
          {errorMessage(actionError)}
        </p>
      )}

      {tracks.length === 0 ? (
        <EmptyState title={t('library.emptyPlaylist')} text={t('library.emptyPlaylistHint')} />
      ) : (
        <TrackList
          tracks={tracks}
          label={heading}
          variant="playlist"
          showFavorite={!playlist.is_favorites}
          onRemove={handleRemove}
        />
      )}

      {dialog === 'rename' && (
        <PlaylistTitleDialog
          title={t('library.renameTitle')}
          submitLabel={t('common.save')}
          busyLabel={t('common.saving')}
          initialTitle={playlist.title}
          onSubmit={handleRename}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          title={t('library.deleteTitle', { title: playlist.title })}
          text={t('library.deleteText')}
          confirmLabel={t('library.delete')}
          busyLabel={t('common.deleting')}
          onConfirm={handleDelete}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
