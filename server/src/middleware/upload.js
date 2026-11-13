import path from 'node:path';
import multer from 'multer';
import config from '../config/index.js';
import AppError from '../utils/AppError.js';

const BYTES_IN_MB = 1024 * 1024;

//файл перевіряється тричі: розширення, MIME-тип і сигнатура вмісту
export const AUDIO_FORMATS = Object.freeze({
  '.mp3': Object.freeze({
    contentType: 'audio/mpeg',
    mimeTypes: Object.freeze(['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3']),
    //тег ID3 або одразу кадр MPEG (11 одиничних бітів синхронізації)
    matches: (bytes) =>
      bytes.subarray(0, 3).toString('latin1') === 'ID3' ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
  }),
  '.wav': Object.freeze({
    contentType: 'audio/wav',
    mimeTypes: Object.freeze(['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave']),
    //контейнер RIFF із типом WAVE (байти 0–3 і 8–11)
    matches: (bytes) =>
      bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
      bytes.subarray(8, 12).toString('latin1') === 'WAVE',
  }),
});

function unsupportedFormat() {
  return new AppError(
    415,
    'UNSUPPORTED_MEDIA_TYPE',
    'Непідтримуваний формат файлу. Завантажте аудіо у форматі MP3 або WAV',
  );
}

export function getAudioFormat(filename) {
  return AUDIO_FORMATS[path.extname(filename).toLowerCase()];
}

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

//відсутність файлу тут не помилка — її перевіряє валідація маршруту
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
