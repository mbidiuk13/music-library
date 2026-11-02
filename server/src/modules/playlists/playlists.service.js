/**
 * @module modules/playlists/playlists.service
 * @description Бізнес-логіка Playlist Service (UC-4, UC-11, FR-9, FR-10): плейлисти користувача
 * та їхній вміст. Користувач бачить і змінює лише власні плейлисти: чужий плейлист для нього
 * «не існує» (404), щоб не розкривати навіть факт його наявності. Плейлист «Улюблені»
 * створюється під час реєстрації і є системним.
 */

import config from '../../config/index.js';
import AppError from '../../utils/AppError.js';
import * as repository from './playlists.repository.js';

/** Код помилки PostgreSQL «порушення унікальності» (unique_violation). */
const UNIQUE_VIOLATION = '23505';

/** Код помилки PostgreSQL «порушення зовнішнього ключа» (foreign_key_violation). */
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * Створює помилку «плейлист не знайдено» (зокрема для чужого плейлиста).
 * @returns {AppError} 404 PLAYLIST_NOT_FOUND.
 */
function playlistNotFound() {
  return new AppError(404, 'PLAYLIST_NOT_FOUND', 'Плейлист не знайдено');
}

/**
 * Створює помилку «дія з плейлистом «Улюблені» заборонена».
 * @param {string} message - яку саме дію заборонено.
 * @returns {AppError} 403 FAVORITES_PROTECTED.
 */
function favoritesProtected(message) {
  return new AppError(403, 'FAVORITES_PROTECTED', message);
}

/**
 * Перетворює порушення обмежень БД на зрозумілу клієнту помилку.
 * @param {Error & {code?: string, constraint?: string}} err - помилка PostgreSQL.
 * @returns {Error} AppError для відомих порушень, інакше — сама помилка без змін.
 */
function toAppError(err) {
  if (err.code === UNIQUE_VIOLATION && err.constraint === 'playlist_user_id_title_key') {
    return new AppError(409, 'PLAYLIST_TITLE_TAKEN', 'Плейлист з такою назвою вже існує');
  }
  if (err.code === FOREIGN_KEY_VIOLATION && err.constraint === 'playlist_user_id_fkey') {
    // Токен ще дійсний, але обліковий запис уже видалено.
    return new AppError(
      401,
      'INVALID_TOKEN',
      'Сесія недійсна або завершилася. Увійдіть до системи знову',
    );
  }
  return err;
}

/**
 * Перевіряє, чи є плейлист системним плейлистом «Улюблені».
 * @param {{title: string}} playlist - плейлист.
 * @returns {boolean} true для «Улюблених».
 */
function isFavorites(playlist) {
  return playlist.title === config.favoritesTitle;
}

/**
 * Формує відповідь з даними плейлиста: додає ознаку `is_favorites`, за якою клієнт
 * ховає дії «Перейменувати» і «Видалити».
 * @param {{id: string, title: string, created_at: Date, track_count: number}} playlist - рядок з БД.
 * @returns {{id: string, title: string, created_at: Date, track_count: number, is_favorites: boolean}}
 *   дані плейлиста.
 */
function toPlaylist(playlist) {
  return { ...playlist, is_favorites: isFavorites(playlist) };
}

/**
 * Повертає плейлист користувача.
 * @param {string} userId - UUID користувача.
 * @param {string} id - UUID плейлиста.
 * @returns {Promise<object>} рядок плейлиста з БД (з кількістю треків).
 * @throws {AppError} 404 PLAYLIST_NOT_FOUND, якщо плейлиста немає або він чужий.
 */
async function requireOwnPlaylist(userId, id) {
  const playlist = await repository.findPlaylist(id, userId);
  if (!playlist) throw playlistNotFound();
  return playlist;
}

/**
 * Повертає плейлисти користувача з кількістю треків; «Улюблені» — першим.
 * @param {string} userId - UUID користувача.
 * @returns {Promise<object[]>} плейлисти.
 */
export async function listPlaylists(userId) {
  const playlists = await repository.listPlaylists(userId, config.favoritesTitle);
  return playlists.map(toPlaylist);
}

/**
 * Створює порожній плейлист (UC-4). Назва унікальна в межах користувача (UNIQUE (user_id, title)).
 * @param {string} userId - UUID користувача.
 * @param {string} title - назва 1–100 символів (уже обрізана).
 * @returns {Promise<object>} створений плейлист.
 * @throws {AppError} 409 PLAYLIST_TITLE_TAKEN — у користувача вже є плейлист з такою назвою;
 *   401 INVALID_TOKEN — обліковий запис видалено.
 */
export async function createPlaylist(userId, title) {
  try {
    const playlist = await repository.insertPlaylist(userId, title);
    return toPlaylist({ ...playlist, track_count: 0 });
  } catch (err) {
    throw toAppError(err);
  }
}

/**
 * Повертає плейлист разом з його треками (в порядку додавання).
 * @param {string} userId - UUID користувача.
 * @param {string} id - UUID плейлиста.
 * @returns {Promise<{playlist: object, tracks: object[]}>} плейлист і треки з датою додавання.
 * @throws {AppError} 404 PLAYLIST_NOT_FOUND.
 */
export async function getPlaylist(userId, id) {
  const playlist = await requireOwnPlaylist(userId, id);
  const tracks = await repository.listPlaylistTracks(id);
  return { playlist: toPlaylist(playlist), tracks };
}

/**
 * Перейменовує плейлист (UC-11). «Улюблені» перейменувати не можна.
 * @param {string} userId - UUID користувача.
 * @param {string} id - UUID плейлиста.
 * @param {string} title - нова назва 1–100 символів (уже обрізана).
 * @returns {Promise<object>} оновлений плейлист.
 * @throws {AppError} 404 PLAYLIST_NOT_FOUND; 403 FAVORITES_PROTECTED;
 *   409 PLAYLIST_TITLE_TAKEN — у користувача вже є інший плейлист з такою назвою.
 */
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

/**
 * Видаляє плейлист (UC-11); треки лишаються в медіатеці. «Улюблені» видалити не можна.
 * @param {string} userId - UUID користувача.
 * @param {string} id - UUID плейлиста.
 * @returns {Promise<void>}
 * @throws {AppError} 404 PLAYLIST_NOT_FOUND; 403 FAVORITES_PROTECTED.
 */
export async function deletePlaylist(userId, id) {
  const playlist = await requireOwnPlaylist(userId, id);
  if (isFavorites(playlist)) {
    throw favoritesProtected('Плейлист «Улюблені» не можна видалити');
  }
  if (!(await repository.deletePlaylist(id, userId))) throw playlistNotFound();
}
