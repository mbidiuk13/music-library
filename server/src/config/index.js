//.env підключається прапорцем Node.js `--env-file`, без пакета dotenv
import { fileURLToPath } from 'node:url';

function readPositiveInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Змінна середовища ${name} має бути цілим додатним числом, отримано: "${raw}"`);
  }
  return value;
}

function readString(name, fallback = '') {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : raw;
}

const nodeEnv = readString('NODE_ENV', 'development');

const DEFAULT_CLIENT_DIST = fileURLToPath(new URL('../../../client/dist', import.meta.url));

const config = Object.freeze({
  port: readPositiveInt('PORT', 4000),
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  clientUrl: readString('CLIENT_URL', 'http://localhost:5173'),
  clientDist: readString('CLIENT_DIST', DEFAULT_CLIENT_DIST),

  databaseUrl: readString('DATABASE_URL'),

  jwt: Object.freeze({
    secret: readString('JWT_SECRET'),
    expiresIn: readString('JWT_EXPIRES_IN', '24h'),
    passwordResetExpiresIn: '15m',
  }),

  s3: Object.freeze({
    region: readString('AWS_REGION', 'eu-central-1'),
    bucket: readString('S3_BUCKET'),
    presignTtl: readPositiveInt('S3_PRESIGN_TTL', 3600),
    maxUploadMb: readPositiveInt('MAX_UPLOAD_MB', 50),
  }),

  recommendations: Object.freeze({
    minHistory: readPositiveInt('REC_MIN_HISTORY', 5),
    topN: readPositiveInt('REC_TOP_N', 20),
    popularLimit: readPositiveInt('POPULAR_LIMIT', 100),
  }),

  //системний плейлист кожного користувача; видалити його не можна
  favoritesTitle: 'Улюблені',

  bcryptSaltRounds: 10,

  admin: Object.freeze({
    email: readString('ADMIN_EMAIL'),
    password: readString('ADMIN_PASSWORD'),
    username: readString('ADMIN_USERNAME', 'Адміністратор'),
  }),

  smtp: Object.freeze({
    host: readString('SMTP_HOST'),
    port: readPositiveInt('SMTP_PORT', 587),
    user: readString('SMTP_USER'),
    pass: readString('SMTP_PASS'),
    from: readString('MAIL_FROM', 'MusicLibrary <no-reply@musiclibrary.local>'),
  }),
});

export default config;
