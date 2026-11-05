/**
 * @module pages/HomePage
 * @description Головна сторінка (рис. 4.2 ТЗ, маршрут `/`): блок «Підібрано для вас» — персональні
 * рекомендації Recommendation Engine (лише авторизованим) і блок «Популярне — Топ-100»
 * за кількістю відтворень (усім). Якщо історія прослуховувань ще коротка, сервер повертає
 * резервну гілку (`source: "popular"`) — тоді блок рекомендацій показує популярні треки з поясненням.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPersonal, fetchPopular } from '../api/recommendations.js';
import { EmptyState, RequestError, TrackListSkeleton } from '../components/RequestState.jsx';
import TrackCard from '../components/TrackCard.jsx';
import TrackList from '../components/TrackList.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePlayer } from '../context/PlayerContext.jsx';
import useRequest from '../hooks/useRequest.js';

/** Скільки карток показувати в блоці «Підібрано для вас» (N = 20 у ПЗ, розд. 3.3.1). */
const RECOMMENDATION_CARDS = 20;

/**
 * Блок «Підібрано для вас»: горизонтальний ряд карток.
 * @param {{userId: string}} props - id користувача (зміна акаунта — новий запит).
 * @returns {JSX.Element} секція з рекомендаціями.
 */
function RecommendedSection({ userId }) {
  const { t } = useTranslation();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  // userId входить у функцію запиту, щоб для іншого користувача запит виконувався заново.
  const load = useMemo(() => (userId ? (signal) => fetchPersonal(signal) : null), [userId]);
  const { data, error, isLoading, reload } = useRequest(load);
  const tracks = data?.tracks.slice(0, RECOMMENDATION_CARDS) ?? [];

  return (
    <section className="home-section" aria-labelledby="recommended-title">
      <h2 id="recommended-title" className="section-title">
        {t('home.recommended')}
      </h2>
      {data?.source === 'popular' && <p className="section-note">{t('home.coldStart')}</p>}
      {isLoading && <TrackListSkeleton rows={2} />}
      {error && <RequestError error={error} onRetry={reload} />}
      {data && tracks.length === 0 && <EmptyState title={t('home.emptyLibrary')} />}
      {tracks.length > 0 && (
        <ul className="card-row" aria-label={t('home.recommended')}>
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              isCurrent={currentTrack?.id === track.id}
              isPlaying={isPlaying}
              onPlay={() => playTrack(track, tracks)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Блок «Популярне — Топ-100»: нумерований список.
 * @returns {JSX.Element} секція з популярними треками.
 */
function PopularSection() {
  const { t } = useTranslation();
  const { data, error, isLoading, reload } = useRequest(fetchPopular);

  return (
    <section className="home-section" aria-labelledby="popular-title">
      <h2 id="popular-title" className="section-title">
        {t('home.popular')}
      </h2>
      {isLoading && <TrackListSkeleton />}
      {error && <RequestError error={error} onRetry={reload} />}
      {data && data.tracks.length === 0 && <EmptyState title={t('home.emptyLibrary')} />}
      {data && data.tracks.length > 0 && (
        <TrackList tracks={data.tracks} label={t('home.popular')} />
      )}
    </section>
  );
}

/**
 * Головна сторінка.
 * @returns {JSX.Element} сторінка.
 */
export default function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div className="page page--home">
      <h1 className="visually-hidden">{t('pages.home.title')}</h1>
      {user && <RecommendedSection userId={user.id} />}
      <PopularSection />
    </div>
  );
}
