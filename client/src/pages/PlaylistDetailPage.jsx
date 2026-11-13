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
import { useToast } from '../context/ToastContext.jsx';
import useRequest from '../hooks/useRequest.js';
import { errorMessage } from '../utils/errors.js';

export default function PlaylistDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { updatePlaylists } = useOutletContext();
  const { markFavorite } = useFavorites();
  const { showToast } = useToast();

  const load = useMemo(() => (signal) => fetchPlaylist(id, signal), [id]);
  const { data, error, isLoading, reload } = useRequest(load);

  //локальні зміни (перейменування, вилучені треки) належать конкретній відповіді сервера
  const [edits, setEdits] = useState({ data: null, playlist: null, tracks: null });
  const current = edits.data === data && edits.playlist ? edits : data;
  const playlist = current?.playlist;
  const tracks = current?.tracks;

  const [dialog, setDialog] = useState(/** @type {'rename'|'delete'|null} */ (null));
  const [actionError, setActionError] = useState(/** @type {unknown} */ (null));

  const updateLocal = (update) =>
    setEdits((prev) => {
      const base = prev.data === data && prev.playlist ? prev : data;
      return { data, ...update({ playlist: base.playlist, tracks: base.tracks }) };
    });

  //якщо трека в плейлисті вже немає (404), рядок теж прибирається
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
    showToast(t('library.trackRemoved', { title: track.title }));
  };

  //трек додано до іншого плейлиста — оновлюються картки медіатеки над панеллю
  const handleAddedElsewhere = (target, { created }) => {
    updatePlaylists((list) =>
      created
        ? [...list, target]
        : list.map((item) =>
            item.id === target.id ? { ...item, track_count: item.track_count + 1 } : item,
          ),
    );
  };

  const handleRename = async (title) => {
    const { playlist: renamed } = await renamePlaylist(id, title);
    updateLocal((state) => ({ ...state, playlist: { ...state.playlist, title: renamed.title } }));
    updatePlaylists((list) =>
      list.map((item) => (item.id === id ? { ...item, title: renamed.title } : item)),
    );
    setDialog(null);
    showToast(t('library.renamed', { title: renamed.title }));
  };

  const handleDelete = async () => {
    await deletePlaylist(id);
    updatePlaylists((list) => list.filter((item) => item.id !== id));
    showToast(t('library.deleted', { title: playlist.title }));
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
          <EmptyState title={t('library.notFound')}>
            <Link to="/playlists" className="btn-secondary">
              {t('library.backToPlaylists')}
            </Link>
          </EmptyState>
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
          onAddedToPlaylist={handleAddedElsewhere}
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
