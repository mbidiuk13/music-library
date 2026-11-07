/**
 * @module pages/SearchPage
 * @description Сторінка пошуку (рис. 4.3 ТЗ, UC-3, маршрут `/search`): рядок пошуку за назвою,
 * виконавцем чи жанром і плитки «Навігація за жанрами». Пошук запускається клавішею Enter або
 * вибором жанру; параметри зберігаються в адресі (`?q=…` / `?genre=…`), тому працює кнопка «Назад».
 * Порожній запит не надсилається; якщо збігів немає — «Нічого не знайдено».
 */

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchVocabularies, searchTracks } from '../api/tracks.js';
import Icon from '../components/Icon.jsx';
import { EmptyState, RequestError, TrackListSkeleton } from '../components/RequestState.jsx';
import TrackList from '../components/TrackList.jsx';
import useRequest from '../hooks/useRequest.js';
import { genreGradient } from '../utils/genres.js';
import { LIMITS, validateSearchQuery } from '../utils/validation.js';

/** Кількість результатів, що завантажуються за один раз. */
const PAGE_SIZE = 50;

/**
 * Рядок пошуку. Перемонтовується (key) при зміні запиту в адресі, щоб показувати актуальний текст.
 * @param {object} props - властивості.
 * @param {string} props.initialQuery - запит з адреси.
 * @param {string|null} props.initialError - ключ i18n помилки запиту з адреси (напр. задовгий).
 * @param {(query: string) => void} props.onSearch - запуск пошуку з перевіреним запитом.
 * @param {() => void} props.onClear - очищення пошуку.
 * @returns {JSX.Element} форма пошуку.
 */
function SearchForm({ initialQuery, initialError, onSearch, onClear }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initialQuery);
  const [error, setError] = useState(initialError);

  /**
   * Первинна валідація запиту на клієнті (UC-3) і запуск пошуку.
   * @param {import('react').FormEvent<HTMLFormElement>} event - подія надсилання (Enter).
   * @returns {void}
   */
  const handleSubmit = (event) => {
    event.preventDefault();
    const validationError = validateSearchQuery(draft);
    setError(validationError);
    if (!validationError) onSearch(draft.trim());
  };

  /**
   * Очищає поле і результати.
   * @returns {void}
   */
  const handleClear = () => {
    setDraft('');
    setError(null);
    onClear();
  };

  return (
    <form className="search-form" role="search" onSubmit={handleSubmit} noValidate>
      <label className="visually-hidden" htmlFor="search-query">
        {t('search.label')}
      </label>
      <div className={error ? 'search-box search-box--invalid' : 'search-box'}>
        <Icon name="search" size={22} className="search-box__icon" />
        <input
          id="search-query"
          type="search"
          className="search-box__input"
          placeholder={t('search.placeholder')}
          value={draft}
          maxLength={LIMITS.queryMax}
          autoComplete="off"
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'search-query-error' : undefined}
        />
        {draft && (
          <button
            type="button"
            className="icon-button"
            onClick={handleClear}
            aria-label={t('search.clear')}
            title={t('search.clear')}
          >
            <Icon name="close" />
          </button>
        )}
      </div>
      {error && (
        <p id="search-query-error" className="field__error" role="alert">
          {t(error, LIMITS)}
        </p>
      )}
    </form>
  );
}

/**
 * Плитки «Навігація за жанрами».
 * @param {{onSelect: (genre: string) => void}} props - вибір жанру.
 * @returns {JSX.Element} секція з плитками.
 */
function GenreTiles({ onSelect }) {
  const { t } = useTranslation();
  const { data, error, isLoading, reload } = useRequest(fetchVocabularies);
  return (
    <section aria-labelledby="genres-title">
      <h2 id="genres-title" className="section-title">
        {t('search.genres')}
      </h2>
      {isLoading && <TrackListSkeleton rows={2} />}
      {error && <RequestError error={error} onRetry={reload} />}
      {data && (
        <ul className="genre-grid">
          {data.genres.map((genre, index) => (
            <li key={genre}>
              <button
                type="button"
                className="genre-tile"
                style={{ background: genreGradient(genre, index) }}
                onClick={() => onSelect(genre)}
              >
                {genre}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Результати пошуку з кнопкою «Показати ще».
 * @param {{q: string, genre: string, onClear: () => void}} props - параметри пошуку з адреси.
 * @returns {JSX.Element} секція з результатами.
 */
function SearchResults({ q, genre, onClear }) {
  const { t } = useTranslation();
  const load = useMemo(
    () => (signal) => searchTracks({ q, genre, limit: PAGE_SIZE, offset: 0 }, signal),
    [q, genre],
  );
  const { data, error, isLoading, reload } = useRequest(load);

  // Додаткові сторінки належать конкретному запиту (load): для нового запиту вони не показуються.
  const [more, setMore] = useState({ load: null, tracks: [], isLoading: false, error: null });
  const extra = more.load === load ? more : { tracks: [], isLoading: false, error: null };
  const tracks = data ? [...data.tracks, ...extra.tracks] : [];
  const hasMore = Boolean(data) && tracks.length < data.total;

  /**
   * Завантажує наступну сторінку результатів.
   * @returns {Promise<void>}
   */
  const handleLoadMore = async () => {
    setMore({ load, tracks: extra.tracks, isLoading: true, error: null });
    try {
      const page = await searchTracks({ q, genre, limit: PAGE_SIZE, offset: tracks.length });
      setMore({ load, tracks: [...extra.tracks, ...page.tracks], isLoading: false, error: null });
    } catch (err) {
      setMore({ load, tracks: extra.tracks, isLoading: false, error: err });
    }
  };

  const title = genre ? t('search.genreTitle', { genre }) : t('search.queryTitle', { query: q });

  return (
    <section aria-labelledby="results-title" aria-busy={isLoading}>
      <div className="results-head">
        <div>
          <h2 id="results-title" className="section-title">
            {title}
          </h2>
          {data && data.total > 0 && (
            <p className="section-note">{t('search.found', { count: data.total })}</p>
          )}
        </div>
        <button type="button" className="btn-secondary" onClick={onClear}>
          {t('search.backToGenres')}
        </button>
      </div>

      {isLoading && <TrackListSkeleton />}
      {error && <RequestError error={error} onRetry={reload} />}
      {data && data.total === 0 && (
        <EmptyState title={t('search.nothingFound')} text={t('search.nothingFoundHint')} />
      )}
      {tracks.length > 0 && <TrackList tracks={tracks} label={title} />}

      {extra.error && (
        <div className="results-more">
          <RequestError error={extra.error} onRetry={handleLoadMore} />
        </div>
      )}
      {hasMore && !extra.error && (
        <button
          type="button"
          className="btn-outline results-more"
          onClick={handleLoadMore}
          disabled={extra.isLoading}
        >
          {t(extra.isLoading ? 'common.loading' : 'search.showMore')}
        </button>
      )}
    </section>
  );
}

/**
 * Сторінка пошуку.
 * @returns {JSX.Element} сторінка.
 */
export default function SearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q')?.trim() ?? '';
  const genre = searchParams.get('genre') ?? '';
  // Запит з адреси проходить ту саму первинну валідацію, що й введений у поле (UC-3).
  const queryError = q ? validateSearchQuery(q) : null;
  const hasSearch = Boolean((q && !queryError) || genre);

  /** Повертає сторінку до плиток жанрів. */
  const clearSearch = () => setSearchParams({});

  return (
    <div className="page page--search">
      <h1 className="visually-hidden">{t('pages.search.title')}</h1>
      <SearchForm
        key={q}
        initialQuery={q}
        initialError={queryError}
        onSearch={(query) => setSearchParams({ q: query })}
        onClear={clearSearch}
      />
      {hasSearch ? (
        <SearchResults q={q} genre={genre} onClear={clearSearch} />
      ) : (
        <GenreTiles onSelect={(selected) => setSearchParams({ genre: selected })} />
      )}
    </div>
  );
}
