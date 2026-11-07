/**
 * @module pages/PlaylistsPage
 * @description Медіатека (рис. 4.4 ТЗ, UC-4, UC-11, маршрути `/playlists` і `/playlists/:id`):
 * картки плейлистів користувача («Улюблені» — першою), кнопка «Новий плейлист», а під картками —
 * треки обраного плейлиста (вкладений маршрут у `<Outlet/>`). Список плейлистів завантажується
 * один раз і лишається на екрані під час перемикання між плейлистами; сторінка плейлиста
 * оновлює в ньому назви й кількість треків через контекст Outlet.
 */

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

/**
 * @typedef {object} LibraryOutletContext
 * @property {(update: (playlists: object[]) => object[]) => void} updatePlaylists - змінює
 *   список карток локально (після перейменування, видалення, зміни кількості треків).
 */

/**
 * Картка плейлиста. «Улюблені» виділяються градієнтом і сердечком (рис. 4.4).
 * @param {{playlist: object, isSelected: boolean}} props - плейлист і чи він відкритий зараз.
 * @returns {JSX.Element} посилання-картка.
 */
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

/**
 * Вміст під картками, коли плейлист ще не обрано (маршрут `/playlists`).
 * @returns {JSX.Element} підказка.
 */
export function PlaylistsIndex() {
  const { t } = useTranslation();
  return (
    <div className="library-panel library-panel--hint">
      <Icon name="queue" size={28} />
      <p>{t('library.chooseHint')}</p>
    </div>
  );
}

/**
 * Сторінка медіатеки.
 * @returns {JSX.Element} сторінка.
 */
export default function PlaylistsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const selected = useMatch('/playlists/:id');
  const { data, error, isLoading, reload } = useRequest(fetchPlaylists);
  const [isCreating, setIsCreating] = useState(false);

  // Локальні зміни списку належать конкретній відповіді сервера (data): після повторного
  // завантаження показується свіжий список.
  const [edits, setEdits] = useState({
    data: null,
    playlists: /** @type {object[]|null} */ (null),
  });
  const playlists = (edits.data === data && edits.playlists) || data?.playlists;

  /** @type {LibraryOutletContext['updatePlaylists']} */
  const updatePlaylists = useCallback(
    (update) =>
      setEdits((prev) => {
        const base = (prev.data === data && prev.playlists) || data?.playlists || [];
        return { data, playlists: update(base) };
      }),
    [data],
  );

  /**
   * Створює плейлист (UC-4), показує сповіщення «Плейлист створено» і відкриває його.
   * @param {string} title - назва нового плейлиста.
   * @returns {Promise<void>}
   * @throws {import('../api/client.js').ApiError} помилка сервера (показується у формі).
   */
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
