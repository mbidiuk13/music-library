/**
 * @module middleware/upload
 * @description Приймання аудіофайлу з форми `multipart/form-data` (multer). Файл тримається
 * в пам'яті до передачі в S3 і має пройти три перевірки: розширення, MIME-тип і сигнатуру
 * вмісту (перші байти) — лише MP3 або WAV. Розмір обмежено MAX_UPLOAD_MB (розділ 3.4 ПЗ).
 */

import path from 'node:path';
import multer from 'multer';
import config from '../config/index.js';
import AppError from '../utils/AppError.js';

/** Кількість байтів в одному мегабайті. */
const BYTES_IN_MB = 1024 * 1024;

/**
 * Допустимі формати аудіо: MIME-тип для збереження в S3, MIME-типи, які надсилають браузери,
 * і перевірка сигнатури вмісту файлу.
 */
export const AUDIO_FORMATS = Object.freeze({
  '.mp3': Object.freeze({
    contentType: 'audio/mpeg',
    mimeTypes: Object.freeze(['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3']),
    /**
     * MP3 починається з тегу ID3 або одразу з кадру MPEG (11 одиничних бітів синхронізації).
     * @param {Buffer} bytes - вміст файлу.
     * @returns {boolean} true, якщо вміст схожий на MP3.
     */
    matches: (bytes) =>
      bytes.subarray(0, 3).toString('latin1') === 'ID3' ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
  }),
  '.wav': Object.freeze({
    contentType: 'audio/wav',
    mimeTypes: Object.freeze(['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave']),
    /**
     * WAV — контейнер RIFF із типом WAVE (байти 0–3 і 8–11).
     * @param {Buffer} bytes - вміст файлу.
     * @returns {boolean} true, якщо вміст схожий на WAV.
     */
    matches: (bytes) =>
      bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
      bytes.subarray(8, 12).toString('latin1') === 'WAVE',
  }),
});

/**
 * Створює помилку «непідтримуваний формат файлу».
 * @returns {AppError} 415 UNSUPPORTED_MEDIA_TYPE.
 */
function unsupportedFormat() {
  return new AppError(
    415,
    'UNSUPPORTED_MEDIA_TYPE',
    'Непідтримуваний формат файлу. Завантажте аудіо у форматі MP3 або WAV',
  );
}

/**
 * Повертає опис формату за назвою файлу.
 * @param {string} filename - початкова назва файлу.
 * @returns {object|undefined} елемент AUDIO_FORMATS або undefined для інших розширень.
 */
export function getAudioFormat(filename) {
  return AUDIO_FORMATS[path.extname(filename).toLowerCase()];
}

/**
 * Фільтр multer: пропускає файл, лише якщо збігаються і розширення, і MIME-тип.
 * @param {import('express').Request} req - HTTP-запит.
 * @param {Express.Multer.File} file - відомості про файл (без вмісту).
 * @param {multer.FileFilterCallback} callback - рішення multer.
 * @returns {void}
 */
function audioFileFilter(req, file, callback) {
  const format = getAudioFormat(file.originalname);
  if (!format || !format.mimeTypes.includes(file.mimetype)) {
    callback(unsupportedFormat());
    return;
  }
  callback(null, true);
}

const receiveFile = multer({
  storage: multer.memoryStorage(),
  fileFilter: audioFileFilter,
  limits: {
    fileSize: config.s3.maxUploadMb * BYTES_IN_MB,
    files: 1,
    fields: 20,
    fieldSize: 10 * 1024,
  },
}).single('file');

/**
 * Перетворює помилку multer на прикладну помилку з коректним HTTP-статусом.
 * @param {Error} err - помилка multer або фільтра файлів.
 * @returns {Error} AppError (413 / 400) або початкова помилка.
 */
function toAppError(err) {
  if (!(err instanceof multer.MulterError)) return err;
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError(
      413,
      'FILE_TOO_LARGE',
      `Розмір файлу перевищує допустимі ${config.s3.maxUploadMb} МБ`,
    );
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
    return new AppError(400, 'INVALID_UPLOAD', 'Завантажте один аудіофайл у полі file');
  }
  return new AppError(400, 'INVALID_UPLOAD', 'Некоректна форма завантаження файлу');
}

/**
 * Приймає один аудіофайл з поля `file` у `req.file` (вміст — `req.file.buffer`),
 * текстові поля форми — у `req.body`. Якщо файл не надіслано, `req.file` лишається
 * порожнім — це перевіряє валідація маршруту.
 * @param {import('express').Request} req - HTTP-запит `multipart/form-data`.
 * @param {import('express').Response} res - HTTP-відповідь.
 * @param {import('express').NextFunction} next - наступний middleware.
 * @returns {void}
 */
export default function uploadAudio(req, res, next) {
  receiveFile(req, res, (err) => {
    if (err) {
      next(toAppError(err));
      return;
    }
    if (req.file && !getAudioFormat(req.file.originalname).matches(req.file.buffer)) {
      next(unsupportedFormat());
      return;
    }
    next();
  });
}
