/**
 * @module pages/AdminPage
 * @description Адмін-панель «Керування системою» (рис. 4.5 ТЗ, маршрут `/admin`, лише роль admin):
 * таблиця треків медіатеки з пошуком за ID або назвою, завантаження аудіо з метаданими (UC-9),
 * редагування метаданих (UC-6) і видалення треку з підтвердженням.
 * ID показується скорочено — перші 8 символів UUID (повний — у підказці). Звичайний користувач
 * сюди не потрапляє (RequireAdmin → сторінка 403), а сервер додатково перевіряє роль.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteTrack, fetchAdminTracks, updateTrack, uploadTrack } from '../api/admin.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Icon from '../components/Icon.jsx';
import { EmptyState, RequestError, TrackListSkeleton } from '../components/RequestState.jsx';
import TrackFormDialog from '../components/TrackFormDialog.jsx';
import { usePlayer } from '../context/PlayerContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import useRequest from '../hooks/useRequest.js';
import { shortId } from '../utils/format.js';
import { LIMITS } from '../utils/validation.js';

/** Кількість треків, що завантажуються за один раз. */
const PAGE_SIZE = 50;

/**
 * Локальні зміни поточного списку: додаткові сторінки, видалені й відредаговані треки.
 * @typedef {object} ListChanges
 * @property {Function|null} load - запит, якому належать зміни.
 * @property {object[]} more - треки з наступних сторінок («Показати ще»).
 * @property {string[]} removedIds - id видалених треків.
 * @property {Record<string, object>} updated - відредаговані треки за id.
 */

/** @type {ListChanges} */
const NO_CHANGES = Object.freeze({ load: null, more: [], removedIds: [], updated: {} });

/**
 * Рядок таблиці треків.
 * @param {{track: object, onEdit: () => void, onDelete: () => void}} props - трек і дії з ним.
 * @returns {JSX.Element} рядок таблиці.
 */
function TrackTableRow({ track, onEdit, onDelete }) {
  const { t } = useTranslation();
  const editLabel = t('admin.editTrack', { title: track.title });
  const deleteLabel = t('admin.deleteTrack', { title: track.title });
  return (
    <tr>
      <td>
        <span className="admin-table__id" title={track.id}>
          {shortId(track.id)}
        </span>
      </td>
      <td>
        <span className="admin-table__title" title={track.title}>
          {track.title}
        </span>
        <span className="admin-table__artist" title={track.artist}>
          {track.artist}
        </span>
      </td>
      <td>
        <span className="chip">{track.genre}</span>
      </td>
      <td className="admin-table__bpm">
        {track.bpm}
        <span className="admin-table__unit"> {t('admin.columns.bpm')}</span>
      </td>
      <td>
        <span className="admin-table__actions">
          <button
            type="button"
            className="icon-button"
            onClick={onEdit}
            aria-haspopup="dialog"
            aria-label={editLabel}
            title={editLabel}
          >
            <Icon name="edit" />
          </button>
          <button
            type="button"
            className="icon-button icon-button--danger"
            onClick={onDelete}
            aria-label={deleteLabel}
            title={deleteLabel}
          >
            <Icon name="trash" />
          </button>
        </span>
      </td>
    </tr>
  );
}

/**
 * Адмін-панель.
 * @returns {JSX.Element} сторінка.
 */
export default function AdminPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { updateTrackInfo } = usePlayer();
  const [query, setQuery] = useState('');
  const searchQuery = useDebouncedValue(query.trim(), 300);

  const load = useMemo(
    () => (signal) =>
      fetchAdminTracks({ q: searchQuery || undefined, limit: PAGE_SIZE, offset: 0 }, signal),
    [searchQuery],
  );
  const { data, error, isLoading, reload } = useRequest(load);

  const [changes, setChanges] = useState(/** @type {ListChanges} */ (NO_CHANGES));
  const current = changes.load === load ? changes : NO_CHANGES;
  const [more, setMore] = useState({ load: null, isLoading: false, error: null });
  const moreState = more.load === load ? more : { isLoading: false, error: null };

  const loadedCount = data ? data.tracks.length + current.more.length : 0;
  const tracks = data
    ? [...data.tracks, ...current.more]
        .filter((track) => !current.removedIds.includes(track.id))
        .map((track) => current.updated[track.id] ?? track)
    : [];
  const total = data ? data.total - current.removedIds.length : 0;
  const hasMore = Boolean(data) && loadedCount < data.total;

  const [deleting, setDeleting] = useState(/** @type {object|null} */ (null));
  const [form, setForm] = useState(/** @type {{track: object|null}|null} */ (null));

  /**
   * Змінює локальний стан списку для поточного запиту.
   * @param {(changes: ListChanges) => Partial<ListChanges>} update - функція оновлення.
   * @returns {void}
   */
  const updateChanges = (update) =>
    setChanges((prev) => {
      const base = prev.load === load ? prev : { ...NO_CHANGES, load };
      return { ...base, ...update(base), load };
    });

  /**
   * Завантажує наступну сторінку таблиці. Зсув враховує вже видалені треки.
   * @returns {Promise<void>}
   */
  const handleLoadMore = async () => {
    setMore({ load, isLoading: true, error: null });
    try {
      const page = await fetchAdminTracks({
        q: searchQuery || undefined,
        limit: PAGE_SIZE,
        offset: loadedCount - current.removedIds.length,
      });
      const known = new Set([...data.tracks, ...current.more].map((track) => track.id));
      updateChanges((base) => ({
        more: [...base.more, ...page.tracks.filter((track) => !known.has(track.id))],
      }));
      setMore({ load, isLoading: false, error: null });
    } catch (err) {
      setMore({ load, isLoading: false, error: err });
    }
  };

  /**
   * Зберігає форму треку: завантажує новий трек (UC-9) або оновлює метадані наявного (UC-6).
   * Новий трек з'являється першим після повторного завантаження таблиці (новіші — першими);
   * відредагований оновлюється на місці — і в таблиці, і в черзі плеєра (якщо він зараз грає,
   * плеєр одразу показує нову назву).
   * @param {FormData|object} payload - FormData з файлом (новий трек) або 7 полів метаданих.
   * @returns {Promise<void>}
   * @throws {import('../api/client.js').ApiError} помилка сервера (показується у формі).
   */
  const handleSave = async (payload) => {
    if (form.track) {
      const { track } = await updateTrack(form.track.id, payload);
      updateChanges((base) => ({ updated: { ...base.updated, [track.id]: track } }));
      updateTrackInfo(track);
      showToast(t('admin.saved', { title: track.title }));
    } else {
      const { track } = await uploadTrack(payload);
      setChanges(NO_CHANGES);
      reload();
      showToast(t('admin.uploaded', { title: track.title }));
    }
    setForm(null);
  };

  /**
   * Видаляє трек (запис у БД каскадно з плейлистами й історією, аудіофайл — з S3).
   * @returns {Promise<void>}
   * @throws {import('../api/client.js').ApiError} помилка сервера (показується у вікні).
   */
  const handleDelete = async () => {
    try {
      await deleteTrack(deleting.id);
    } catch (err) {
      if (err.code !== 'TRACK_NOT_FOUND') throw err;
    }
    const { id, title } = deleting;
    updateChanges((base) => ({ removedIds: [...base.removedIds, id] }));
    showToast(t('admin.deleted', { title }));
    setDeleting(null);
  };

  return (
    <div className="page page--admin">
      <header className="page-head">
        <h1 className="page-head__title">{t('admin.title')}</h1>
        <button
          type="button"
          className="btn-primary btn-primary--glow"
          onClick={() => setForm({ track: null })}
          aria-haspopup="dialog"
        >
          <Icon name="upload" />
          {t('admin.upload')}
        </button>
      </header>

      <section className="admin-panel" aria-labelledby="admin-table-title">
        <div className="admin-panel__head">
          <div>
            <h2 id="admin-table-title" className="admin-panel__title">
              <span className="admin-panel__dot" aria-hidden="true" />
              {t('admin.tableTitle')}
            </h2>
            {data && (
              <p className="admin-panel__count" aria-live="polite">
                {t(searchQuery ? 'admin.found' : 'admin.total', { count: total })}
              </p>
            )}
          </div>
          <div className="search-box search-box--compact" role="search">
            <Icon name="search" size={20} className="search-box__icon" />
            <label className="visually-hidden" htmlFor="admin-search">
              {t('admin.searchLabel')}
            </label>
            <input
              id="admin-search"
              type="search"
              className="search-box__input"
              placeholder={t('admin.searchPlaceholder')}
              value={query}
              maxLength={LIMITS.queryMax}
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        {isLoading && <TrackListSkeleton rows={5} />}
        {error && <RequestError error={error} onRetry={reload} />}
        {data && tracks.length === 0 && (
          <EmptyState
            title={t(searchQuery ? 'search.nothingFound' : 'home.emptyLibrary')}
            text={searchQuery ? t('admin.nothingFoundHint') : undefined}
          />
        )}
        {tracks.length > 0 && (
          <div className="admin-table__wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">{t('admin.columns.id')}</th>
                  <th scope="col">{t('admin.columns.metadata')}</th>
                  <th scope="col">{t('admin.columns.genre')}</th>
                  <th scope="col">{t('admin.columns.bpm')}</th>
                  <th scope="col" className="admin-table__actions-head">
                    {t('admin.columns.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track) => (
                  <TrackTableRow
                    key={track.id}
                    track={track}
                    onEdit={() => setForm({ track })}
                    onDelete={() => setDeleting(track)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {moreState.error && <RequestError error={moreState.error} onRetry={handleLoadMore} />}
        {hasMore && !moreState.error && (
          <button
            type="button"
            className="btn-outline admin-panel__more"
            onClick={handleLoadMore}
            disabled={moreState.isLoading}
          >
            {t(moreState.isLoading ? 'common.loading' : 'search.showMore')}
          </button>
        )}
      </section>

      {form && (
        <TrackFormDialog track={form.track} onSubmit={handleSave} onClose={() => setForm(null)} />
      )}
      {deleting && (
        <ConfirmDialog
          title={t('admin.deleteTitle', { title: deleting.title })}
          text={t('admin.deleteText', { title: deleting.title, artist: deleting.artist })}
          confirmLabel={t('library.delete')}
          busyLabel={t('common.deleting')}
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
