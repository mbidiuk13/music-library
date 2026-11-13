import * as playlistService from './playlists.service.js';

export async function listPlaylists(req, res) {
  res.json({ playlists: await playlistService.listPlaylists(req.user.id, req.query.trackId) });
}

export async function createPlaylist(req, res) {
  const playlist = await playlistService.createPlaylist(req.user.id, req.body.title);
  res.status(201).json({ playlist });
}

export async function createPlaylistWithTrack(req, res) {
  const { title, trackId } = req.body;
  res.status(201).json(await playlistService.createPlaylistWithTrack(req.user.id, title, trackId));
}

export async function getPlaylist(req, res) {
  res.json(await playlistService.getPlaylist(req.user.id, req.params.id));
}

export async function renamePlaylist(req, res) {
  const playlist = await playlistService.renamePlaylist(req.user.id, req.params.id, req.body.title);
  res.json({ playlist });
}

export async function deletePlaylist(req, res) {
  await playlistService.deletePlaylist(req.user.id, req.params.id);
  res.status(204).end();
}

export async function addTrack(req, res) {
  const track = await playlistService.addTrack(req.user.id, req.params.id, req.body.trackId);
  res.status(201).json({ track });
}

export async function removeTrack(req, res) {
  await playlistService.removeTrack(req.user.id, req.params.id, req.params.trackId);
  res.status(204).end();
}

export async function listFavoriteIds(req, res) {
  res.json({ ids: await playlistService.listFavoriteIds(req.user.id) });
}

export async function addFavorite(req, res) {
  const track = await playlistService.addFavorite(req.user.id, req.params.trackId);
  res.status(201).json({ track });
}

export async function removeFavorite(req, res) {
  await playlistService.removeFavorite(req.user.id, req.params.trackId);
  res.status(204).end();
}
