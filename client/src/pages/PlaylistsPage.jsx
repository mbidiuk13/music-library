import { useCallback, useState } from 'react';
import { Link, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createPlaylist, fetchPlaylists } from '../api/playlists.js';
import Icon from '../components/Icon.jsx';
import PlaylistTitleDialog from '../components/PlaylistTitleDialog.jsx';
import { RequestError, TrackListSkeleton } from '../components/RequestState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useRequest from '../hooks/useRequest.js';
import { coverGradient } from '../utils/cover.js';

function PlaylistCard({ playlist, isSelected }) {
  const { t } = useTranslation();
  const classes = ['playlist-card'];
  if (playlist.is_favorites) classes.push('playlist-card--favorites');
  if (isSelected) classes.push('playlist-card--selected');
  return (
    <Link
      to={`/playlists/${playlist.id}`}
      className={classes.join(' ')}
      aria-current={isSelected ? 'page' : undefined}
    >
      <span
        className="playlist-card__cover"
        style={playlist.is_favorites ? undefined : { background: coverGradient(playlist.id) }}
        aria-hidden="true"
      >
        <Icon
          name={playlist.is_favorites ? 'heart' : 'queue'}
          size={playlist.is_favorites ? 34 : 28}
        />
      </span>
      <span className="playlist-card__meta">
        <span className="playlist-card__title" title={playlist.title}>
          {playlist.title}
        </span>
        <span className="playlist-card__count">
          {t('library.trackCount', { count: playlist.track_count })}
        </span>
      </span>
    </Link>
  );
}

export function PlaylistsIndex() {
  const { t } = useTranslation();
  return (
    <div className="library-panel library-panel--hint">
      <Icon name="queue" size={28} />
      <p>{t('library.chooseHint')}</p>
    </div>
  );
}

export default function PlaylistsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const selected = useMatch('/playlists/:id');
  const { data, error, isLoading, reload } = useRequest(fetchPlaylists);
  const [isCreating, setIsCreating] = useState(false);

  /*локальні зміни списку належать конкретній відповіді сервера (data): після повторного
  завантаження показується свіжий список*/
  const [edits, setEdits] = useState({
    data: null,
    playlists: /** @type {object[]|null} */ (null),
  });
  const playlists = (edits.data === data && edits.playlists) || data?.playlists;

  //сторінка плейлиста (Outlet) змінює картки локально, без повторного завантаження списку
  const updatePlaylists = useCallback(
    (update) =>
      setEdits((prev) => {
        const base = (prev.data === data && prev.playlists) || data?.playlists || [];
        return { data, playlists: update(base) };
      }),
    [data],
  );

  const handleCreate = async (title) => {
    const { playlist } = await createPlaylist(title);
    updatePlaylists((list) => [...list, playlist]);
    setIsCreating(false);
    showToast(t('library.created', { title: playlist.title }));
    navigate(`/playlists/${playlist.id}`);
  };

  return (
    <div className="page page--library">
      <header className="page-head">
        <h1 className="page-head__title">{t('library.title')}</h1>
        <button type="button" className="btn-secondary" onClick={() => setIsCreating(true)}>
          <Icon name="plus" />
          {t('library.newPlaylist')}
        </button>
      </header>

      <section aria-label={t('library.playlistsLabel')}>
        {isLoading && <TrackListSkeleton rows={2} />}
        {error && <RequestError error={error} onRetry={reload} />}
        {playlists && (
          <ul className="playlist-grid">
            {playlists.map((playlist) => (
              <li key={playlist.id}>
                <PlaylistCard
                  playlist={playlist}
                  isSelected={selected?.params.id === playlist.id}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Outlet context={{ updatePlaylists }} />

      {isCreating && (
        <PlaylistTitleDialog
          title={t('library.createTitle')}
          submitLabel={t('library.create')}
          busyLabel={t('library.creating')}
          onSubmit={handleCreate}
          onClose={() => setIsCreating(false)}
        />
      )}
    </div>
  );
}
