import config from '../../config/index.js';
import { transaction } from '../../db/pool.js';
import AppError from '../../utils/AppError.js';
import * as repository from './playlists.repository.js';

const UNIQUE_VIOLATION = '23505';

const FOREIGN_KEY_VIOLATION = '23503';

function playlistNotFound() {
  return new AppError(404, 'PLAYLIST_NOT_FOUND', 'Плейлист не знайдено');
}

function favoritesProtected(message) {
  return new AppError(403, 'FAVORITES_PROTECTED', message);
}

function toAppError(err) {
  if (err.code === UNIQUE_VIOLATION && err.constraint === 'playlist_user_id_title_key') {
    return new AppError(409, 'PLAYLIST_TITLE_TAKEN', 'Плейлист з такою назвою вже існує');
  }
  if (err.code === UNIQUE_VIOLATION && err.constraint === 'playlist_track_pkey') {
    return new AppError(409, 'TRACK_ALREADY_IN_PLAYLIST', 'Трек уже є в плейлисті');
  }
  if (err.code === FOREIGN_KEY_VIOLATION && err.constraint === 'playlist_track_track_id_fkey') {
    return new AppError(404, 'TRACK_NOT_FOUND', 'Трек не знайдено');
  }
  if (err.code === FOREIGN_KEY_VIOLATION && err.constraint === 'playlist_track_playlist_id_fkey') {
    //плейлист видалили паралельним запитом після перевірки належності
    return playlistNotFound();
  }
  if (err.code === FOREIGN_KEY_VIOLATION && err.constraint === 'playlist_user_id_fkey') {
    //токен ще дійсний, але обліковий запис уже видалено
    return new AppError(
      401,
      'INVALID_TOKEN',
      'Сесія недійсна або завершилася. Увійдіть до системи знову',
    );
  }
  return err;
}

function isFavorites(playlist) {
  return playlist.title === config.favoritesTitle;
}

//за is_favorites клієнт ховає дії «Перейменувати» і «Видалити»
function toPlaylist(playlist) {
  return { ...playlist, is_favorites: isFavorites(playlist) };
}

//чужий плейлист теж дає 404, щоб не розкривати навіть факт його існування
async function requireOwnPlaylist(userId, id) {
  const playlist = await repository.findPlaylist(id, userId);
  if (!playlist) throw playlistNotFound();
  return playlist;
}

//«Улюблені» — першими; з trackId кожен плейлист має `hasTrack` (чи трек уже в ньому)
export async function listPlaylists(userId, trackId) {
  const playlists = await repository.listPlaylists(userId, config.favoritesTitle, trackId);
  return playlists.map(toPlaylist);
}

export async function createPlaylist(userId, title) {
  try {
    const playlist = await repository.insertPlaylist(userId, title);
    return toPlaylist({ ...playlist, track_count: 0 });
  } catch (err) {
    throw toAppError(err);
  }
}

//одна транзакція: якщо трек додати не вдалося, порожній плейлист не лишається в БД
export async function createPlaylistWithTrack(userId, title, trackId) {
  try {
    return await transaction(async (client) => {
      const playlist = await repository.insertPlaylist(userId, title, client);
      const track = await repository.insertPlaylistTrack(playlist.id, trackId, client);
      return { playlist: toPlaylist({ ...playlist, track_count: 1 }), track };
    });
  } catch (err) {
    throw toAppError(err);
  }
}

export async function getPlaylist(userId, id) {
  const playlist = await requireOwnPlaylist(userId, id);
  const tracks = await repository.listPlaylistTracks(id);
  return { playlist: toPlaylist(playlist), tracks };
}

export async function renamePlaylist(userId, id, title) {
  const playlist = await requireOwnPlaylist(userId, id);
  if (isFavorites(playlist)) {
    throw favoritesProtected('Плейлист «Улюблені» не можна перейменувати');
  }

  let renamed;
  try {
    renamed = await repository.renamePlaylist(id, userId, title);
  } catch (err) {
    throw toAppError(err);
  }
  if (!renamed) throw playlistNotFound();
  return toPlaylist({ ...renamed, track_count: playlist.track_count });
}

export async function deletePlaylist(userId, id) {
  const playlist = await requireOwnPlaylist(userId, id);
  if (isFavorites(playlist)) {
    throw favoritesProtected('Плейлист «Улюблені» не можна видалити');
  }
  if (!(await repository.deletePlaylist(id, userId))) throw playlistNotFound();
}

export async function addTrack(userId, playlistId, trackId) {
  await requireOwnPlaylist(userId, playlistId);
  return insertTrack(playlistId, trackId);
}

async function insertTrack(playlistId, trackId) {
  try {
    return await repository.insertPlaylistTrack(playlistId, trackId);
  } catch (err) {
    throw toAppError(err);
  }
}

export async function removeTrack(userId, playlistId, trackId) {
  await requireOwnPlaylist(userId, playlistId);
  await deleteTrack(playlistId, trackId);
}

async function deleteTrack(playlistId, trackId) {
  if (!(await repository.deletePlaylistTrack(playlistId, trackId))) {
    throw new AppError(404, 'TRACK_NOT_IN_PLAYLIST', 'Трека немає в плейлисті');
  }
}

async function requireFavoritesId(userId) {
  const id = await repository.findPlaylistIdByTitle(userId, config.favoritesTitle);
  if (!id) throw new AppError(404, 'PLAYLIST_NOT_FOUND', 'Плейлист «Улюблені» не знайдено');
  return id;
}

export async function listFavoriteIds(userId) {
  return repository.listTrackIdsByPlaylistTitle(userId, config.favoritesTitle);
}

export async function addFavorite(userId, trackId) {
  return insertTrack(await requireFavoritesId(userId), trackId);
}

export async function removeFavorite(userId, trackId) {
  await deleteTrack(await requireFavoritesId(userId), trackId);
}
