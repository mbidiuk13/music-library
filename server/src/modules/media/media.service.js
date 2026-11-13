import { randomUUID } from 'node:crypto';
import path from 'node:path';
import config from '../../config/index.js';
import { transaction } from '../../db/pool.js';
import { getAudioFormat } from '../../middleware/upload.js';
import s3 from '../../services/s3.js';
import AppError from '../../utils/AppError.js';
import * as repository from './media.repository.js';

const TRACKS_PREFIX = 'tracks/';

function trackNotFound() {
  return new AppError(404, 'TRACK_NOT_FOUND', 'Трек не знайдено');
}

function logStorageError(err, action) {
  if (!config.isTest) console.error(`S3: не вдалося ${action}:`, err.name, err.message);
}

function storageError(err, action) {
  logStorageError(err, action);
  return new AppError(
    500,
    'STORAGE_ERROR',
    'Помилка файлового сховища. Спробуйте повторити дію пізніше',
  );
}

//поля треку, які можна показувати будь-якому користувачу (без s3_key)
export function toPublicTrack(track) {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    genre: track.genre,
    bpm: track.bpm,
    key_signature: track.key_signature,
    mood: track.mood,
    year: track.year,
    play_count: track.play_count,
  };
}

export async function searchTracks({ q, genre, limit, offset }) {
  const { tracks, total } = await repository.searchTracks({ q, genre, limit, offset });
  return { tracks, total, limit, offset };
}

export async function getTrack(id) {
  const track = await repository.findTrackById(id);
  if (!track) throw trackNotFound();
  return toPublicTrack(track);
}

//бакет приватний, тому браузер отримує файл лише за тимчасовим pre-signed URL
export async function getStreamUrl(id) {
  const track = await repository.findTrackById(id);
  if (!track) throw trackNotFound();

  const expiresIn = config.s3.presignTtl;
  try {
    return { url: await s3.getPresignedUrl(track.s3_key, expiresIn), expiresIn };
  } catch (err) {
    throw storageError(err, `підписати посилання на ${track.s3_key}`);
  }
}

//play_count + 1 і запис в user_listen_history (для гостя — без нього) атомарно, в одній транзакції
export async function registerPlay(trackId, userId) {
  return transaction(async (client) => {
    const playCount = await repository.incrementPlayCount(client, trackId);
    if (playCount === undefined) throw trackNotFound();
    if (userId) await repository.insertListen(client, userId, trackId);
    return { id: trackId, play_count: playCount };
  });
}

export async function listTracksForAdmin({ q, limit, offset }) {
  const { tracks, total } = await repository.listTracksForAdmin({ q, limit, offset });
  return { tracks, total, limit, offset };
}

/*спершу файл у S3, потім запис у БД; якщо запис не створено, файл видаляється з S3
(компенсація замість «скасування транзакції» UC-9), щоб у бакеті не лишалося файлів без запису*/
export async function createTrack(metadata, file) {
  const id = randomUUID();
  const extension = path.extname(file.originalname).toLowerCase();
  const key = `${TRACKS_PREFIX}${id}${extension}`;

  try {
    await s3.uploadFile({
      key,
      body: file.buffer,
      contentType: getAudioFormat(file.originalname).contentType,
    });
  } catch (err) {
    throw storageError(err, `завантажити файл ${key}`);
  }

  try {
    return await repository.insertTrack({ ...metadata, id, s3_key: key });
  } catch (err) {
    await s3
      .deleteFile(key)
      .catch((deleteErr) => logStorageError(deleteErr, `видалити файл ${key}`));
    throw err;
  }
}

//кешу векторів немає, тож зміни одразу враховуються в пошуку й рекомендаціях
export async function updateTrack(id, metadata) {
  const track = await repository.updateTrack(id, metadata);
  if (!track) throw trackNotFound();
  return track;
}

//файл з S3 видаляється до COMMIT: якщо S3 недоступний, транзакція відкочується і трек лишається
export async function deleteTrack(id) {
  await transaction(async (client) => {
    const key = await repository.deleteTrack(client, id);
    if (!key) throw trackNotFound();
    try {
      await s3.deleteFile(key);
    } catch (err) {
      throw storageError(err, `видалити файл ${key}`);
    }
  });
}
