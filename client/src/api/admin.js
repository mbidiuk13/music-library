import { request } from './client.js';

export function fetchAdminTracks({ q, limit, offset }, signal) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));
  return request(`/admin/tracks?${params}`, { signal });
}

//formData: поле file (MP3/WAV) і 7 полів метаданих (UC-9)
export function uploadTrack(formData) {
  return request('/admin/tracks', { method: 'POST', body: formData });
}

export function updateTrack(id, metadata) {
  return request(`/admin/tracks/${encodeURIComponent(id)}`, { method: 'PUT', body: metadata });
}

//видаляє трек разом із записами в плейлистах та історії, а також аудіофайл з S3
export function deleteTrack(id) {
  return request(`/admin/tracks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
