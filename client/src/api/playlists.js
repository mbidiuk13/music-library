import { request } from './client.js';

//з trackId кожен плейлист має ознаку hasTrack, чи вже є в ньому цей трек
export function fetchPlaylists(signal, trackId) {
  const path = trackId ? `/playlists?${new URLSearchParams({ trackId })}` : '/playlists';
  return request(path, { signal });
}

export function fetchPlaylist(id, signal) {
  return request(`/playlists/${encodeURIComponent(id)}`, { signal });
}

export function createPlaylist(title) {
  return request('/playlists', { method: 'POST', body: { title } });
}

//одна транзакція на сервері (BPMN рис.1.4)
export function createPlaylistWithTrack(title, trackId) {
  return request('/playlists/with-track', { method: 'POST', body: { title, trackId } });
}

export function renamePlaylist(id, title) {
  return request(`/playlists/${encodeURIComponent(id)}`, { method: 'PATCH', body: { title } });
}

export function deletePlaylist(id) {
  return request(`/playlists/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function addTrackToPlaylist(playlistId, trackId) {
  return request(`/playlists/${encodeURIComponent(playlistId)}/tracks`, {
    method: 'POST',
    body: { trackId },
  });
}

export function removeTrackFromPlaylist(playlistId, trackId) {
  return request(
    `/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`,
    { method: 'DELETE' },
  );
}
