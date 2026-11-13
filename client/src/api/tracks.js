import { request } from './client.js';

export function searchTracks({ q, genre, limit, offset }, signal) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (genre) params.set('genre', genre);
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));
  return request(`/tracks/search?${params}`, { signal });
}

//посилання запитується в момент Play, щоб воно не прострочувалось у списках
export function getStreamUrl(trackId) {
  return request(`/tracks/${encodeURIComponent(trackId)}/stream`);
}

export function registerPlay(trackId) {
  return request(`/tracks/${encodeURIComponent(trackId)}/play`, { method: 'POST' });
}

export function fetchVocabularies(signal) {
  return request('/meta/vocabularies', { signal });
}
