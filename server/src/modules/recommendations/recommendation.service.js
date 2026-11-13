//Content-based рекомендації за косинусною подібністю (розділ 3.3.1 ПЗ, рис.3.4)
import config from '../../config/index.js';
import { cosineSimilarity, preferenceVector } from './cosine.js';
import * as repository from './recommendation.repository.js';
import { getNumericRanges, vectorizeTrack } from './vectorizer.js';

export const SOURCE = Object.freeze({ PERSONAL: 'personal', POPULAR: 'popular' });

//холодний старт: якщо прослухано менше M (REC_MIN_HISTORY = 5) унікальних треків — резервна гілка «Популярне»
export function chooseSource(historySize, minHistory) {
  return historySize < minHistory ? SOURCE.POPULAR : SOURCE.PERSONAL;
}

//той самий порядок, що й у Топ-100: play_count, потім назва та id
function byPopularity(a, b) {
  return (
    b.play_count - a.play_count || a.title.localeCompare(b.title, 'uk') || (a.id < b.id ? -1 : 1)
  );
}

/*перші topN (N = REC_TOP_N = 20) непрослуханих треків за спаданням sim(A_user, B_i);
якщо кандидатів замало — доповнення популярними з `similarity: null`*/
export function rankRecommendations(tracks, listenedIds, topN) {
  const listened = new Set(listenedIds);
  const ranges = getNumericRanges(tracks);
  const vectors = new Map(tracks.map((track) => [track.id, vectorizeTrack(track, ranges)]));

  const userVector = preferenceVector(
    tracks.filter((track) => listened.has(track.id)).map((track) => vectors.get(track.id)),
  );

  const ranked = tracks
    .filter((track) => !listened.has(track.id))
    .map((track) => ({ ...track, similarity: cosineSimilarity(userVector, vectors.get(track.id)) }))
    .sort((a, b) => b.similarity - a.similarity || byPopularity(a, b))
    .slice(0, topN);

  if (ranked.length < topN) {
    const included = new Set(ranked.map((track) => track.id));
    const filler = tracks
      .filter((track) => !included.has(track.id))
      .sort(byPopularity)
      .slice(0, topN - ranked.length)
      .map((track) => ({ ...track, similarity: null }));
    ranked.push(...filler);
  }
  return ranked;
}

export function getPopularTracks() {
  return repository.findPopularTracks(config.recommendations.popularLimit);
}

export async function getPersonalRecommendations(userId) {
  const { minHistory, topN } = config.recommendations;
  const listenedIds = await repository.findListenedTrackIds(userId);

  if (chooseSource(listenedIds.length, minHistory) === SOURCE.POPULAR) {
    return { source: SOURCE.POPULAR, tracks: await getPopularTracks() };
  }

  const tracks = await repository.findAllTracks();
  return { source: SOURCE.PERSONAL, tracks: rankRecommendations(tracks, listenedIds, topN) };
}
