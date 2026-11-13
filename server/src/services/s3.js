//бакет приватний: клієнт отримує лише тимчасові pre-signed URL, ніколи — ключі чи прямі посилання
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config/index.js';

let client;

export function getS3Client() {
  client ??= new S3Client({ region: config.s3.region });
  return client;
}

function getBucket() {
  if (!config.s3.bucket) {
    throw new Error('Не задано S3_BUCKET у файлі .env (див. .env.example)');
  }
  return config.s3.bucket;
}

//lib-storage сам ділить великі файли на частини (multipart upload)
async function uploadFile({ key, body, contentType }) {
  const upload = new Upload({
    client: getS3Client(),
    params: { Bucket: getBucket(), Key: key, Body: body, ContentType: contentType },
  });
  await upload.done();
}

async function deleteFile(key) {
  await getS3Client().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

//404 на відсутній ключ S3 дає лише за наявності права s3:ListBucket (без нього — 403)
async function fileExists(key) {
  try {
    await getS3Client().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

//підпис обчислюється локально, без запиту до AWS
async function getPresignedUrl(key, expiresIn = config.s3.presignTtl) {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(getS3Client(), command, { expiresIn });
}

//об'єкт, щоб у тестах можна було підмінити звернення до AWS
const s3 = { uploadFile, deleteFile, fileExists, getPresignedUrl };

export default s3;
