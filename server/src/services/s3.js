/**
 * @module services/s3
 * @description Робота з об'єктним сховищем AWS S3 (AWS SDK for JavaScript v3).
 * Бакет приватний (Block Public Access увімкнено): клієнт ніколи не отримує ключів доступу
 * чи прямих посилань на об'єкти — відтворення можливе лише через тимчасові pre-signed URL
 * зі строком дії S3_PRESIGN_TTL (розділ 3.4 ПЗ). Ключі IAM-користувача читаються SDK
 * зі змінних середовища AWS_ACCESS_KEY_ID і AWS_SECRET_ACCESS_KEY.
 */

import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config/index.js';

/** @type {S3Client|undefined} */
let client;

/**
 * Повертає (і за потреби створює) клієнт S3 для регіону AWS_REGION.
 * @returns {S3Client} клієнт S3.
 */
export function getS3Client() {
  client ??= new S3Client({ region: config.s3.region });
  return client;
}

/**
 * Повертає назву бакета з конфігурації.
 * @returns {string} значення S3_BUCKET.
 * @throws {Error} якщо S3_BUCKET не задано в .env.
 */
function getBucket() {
  if (!config.s3.bucket) {
    throw new Error('Не задано S3_BUCKET у файлі .env (див. .env.example)');
  }
  return config.s3.bucket;
}

/**
 * Завантажує файл у бакет. Великі файли автоматично передаються частинами
 * (multipart upload через `@aws-sdk/lib-storage`).
 * @param {{key: string, body: Buffer|import('node:stream').Readable, contentType: string}} file -
 *   ключ об'єкта (напр. `tracks/<uuid>.mp3`), вміст і MIME-тип.
 * @returns {Promise<void>}
 * @throws {Error} помилка AWS (немає доступу, бакет не існує, збій мережі).
 */
async function uploadFile({ key, body, contentType }) {
  const upload = new Upload({
    client: getS3Client(),
    params: { Bucket: getBucket(), Key: key, Body: body, ContentType: contentType },
  });
  await upload.done();
}

/**
 * Видаляє об'єкт з бакета. Видалення неіснуючого ключа не є помилкою (S3 відповідає 204).
 * @param {string} key - ключ об'єкта.
 * @returns {Promise<void>}
 * @throws {Error} помилка AWS (немає доступу, збій мережі).
 */
async function deleteFile(key) {
  await getS3Client().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

/**
 * Створює тимчасове посилання (pre-signed URL) на читання об'єкта. Підпис обчислюється
 * локально ключем IAM-користувача, запиту до AWS при цьому немає.
 * @param {string} key - ключ об'єкта.
 * @param {number} [expiresIn=config.s3.presignTtl] - строк дії посилання, секунд.
 * @returns {Promise<string>} URL, за яким браузер може отримати файл до завершення строку дії.
 */
async function getPresignedUrl(key, expiresIn = config.s3.presignTtl) {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(getS3Client(), command, { expiresIn });
}

/** Сервіс S3 (об'єкт, щоб у тестах можна було підмінити звернення до AWS). */
const s3 = { uploadFile, deleteFile, getPresignedUrl };

export default s3;
