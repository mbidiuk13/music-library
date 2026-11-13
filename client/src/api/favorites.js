import { request } from './client.js';

export function fetchFavoriteIds(signal) {
  return request('/favorites/ids', { signal });
}

export function addFavorite(trackId) {
  return request(`/favorites/${encodeURIComponent(trackId)}`, { method: 'POST' });
}

export function removeFavorite(trackId) {
  return request(`/favorites/${encodeURIComponent(trackId)}`, { method: 'DELETE' });
}
