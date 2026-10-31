/**
 * @module modules/media/media.service
 * @description Бізнес-логіка Media Service: керування медіатекою адміністратором —
 * завантаження аудіо в AWS S3 разом із метаданими (UC-9), модерація метаданих (UC-6),
 * видалення треку разом із файлом.
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import config from '../../config/index.js';
import { transaction } from '../../db/pool.js';
import { getAudioFormat } from '../../middleware/upload.js';
import s3 from '../../services/s3.js';
import AppError from '../../utils/AppError.js';
import * as repository from './media.repository.js';

/** Префікс ключів аудіофайлів у бакеті S3. */
const TRACKS_PREFIX = 'tracks/';

/**
 * Створює помилку «трек не знайдено».
 * @returns {AppError} 404 TRACK_NOT_FOUND.
 */
function trackNotFound() {
  return new AppError(404, 'TRACK_NOT_FOUND', 'Трек не знайдено');
}

/**
 * Записує збій сховища S3 у журнал сервера (без ключів доступу — лише назва й текст помилки).
 * @param {Error} err - помилка AWS SDK.
 * @param {string} action - що саме не вдалося.
 * @returns {void}
 */
function logStorageError(err, action) {
  if (!config.isTest) console.error(`S3: не вдалося ${action}:`, err.name, err.message);
}

/**
 * Повідомляє про збій сховища S3: подробиці — в журнал сервера, клієнту — загальне повідомлення.
 * @param {Error} err - помилка AWS SDK.
 * @param {string} action - що саме не вдалося (для журналу).
 * @returns {AppError} 500 STORAGE_ERROR.
 */
function storageError(err, action) {
  logStorageError(err, action);
  return new AppError(
    500,
    'STORAGE_ERROR',
    'Помилка файлового сховища. Спробуйте повторити дію пізніше',
  );
}

/**
 * Повертає сторінку списку треків для адмін-панелі (з ключами файлів у S3).
 * @param {{q?: string, limit: number, offset: number}} params - пошук за ID або назвою, пагінація.
 * @returns {Promise<{tracks: object[], total: number, limit: number, offset: number}>} сторінка списку.
 */
export async function listTracksForAdmin({ q, limit, offset }) {
  const { tracks, total } = await repository.listTracksForAdmin({ q, limit, offset });
  return { tracks, total, limit, offset };
}

/**
 * Додає трек до медіатеки (UC-9): спочатку завантажує файл у S3 під ключем
 * `tracks/<uuid>.<розширення>`, потім створює запис у БД з тим самим UUID.
 * Якщо запис створити не вдалося, файл видаляється з S3 (компенсувальна дія, що
 * відповідає «скасуванню транзакції» з UC-9) — у бакеті не лишається файлів без запису.
 * @param {object} metadata - перевірені метадані: title, artist, genre, bpm, key_signature, mood, year.
 * @param {{originalname: string, buffer: Buffer}} file - перевірений аудіофайл (MP3 або WAV).
 * @returns {Promise<object>} створений трек (з s3_key).
 * @throws {AppError} 500 STORAGE_ERROR, якщо файл не вдалося зберегти в S3.
 * @throws {Error} помилка БД (після видалення файлу з S3).
 */
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

/**
 * Змінює метадані треку (модерація, UC-6). Кешу векторів немає, тому зміни одразу
 * враховуються в пошуку й рекомендаціях.
 * @param {string} id - UUID треку.
 * @param {object} metadata - перевірені метадані: title, artist, genre, bpm, key_signature, mood, year.
 * @returns {Promise<object>} оновлений трек (з s3_key).
 * @throws {AppError} 404 TRACK_NOT_FOUND.
 */
export async function updateTrack(id, metadata) {
  const track = await repository.updateTrack(id, metadata);
  if (!track) throw trackNotFound();
  return track;
}

/**
 * Видаляє трек разом з аудіофайлом. Запис видаляється в транзакції, а файл з S3 — до її
 * підтвердження: якщо S3 недоступний, транзакція відкочується і трек лишається в медіатеці.
 * @param {string} id - UUID треку.
 * @returns {Promise<void>}
 * @throws {AppError} 404 TRACK_NOT_FOUND; 500 STORAGE_ERROR, якщо файл не вдалося видалити.
 */
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
