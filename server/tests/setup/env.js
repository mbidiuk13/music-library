/**
 * @file Підготовка змінних середовища перед кожним тестовим файлом (jest setupFiles).
 * Тести не залежать від локального .env: використовують фіксований тестовий ключ JWT,
 * лише тестову БД (TEST_DATABASE_URL), ніколи не надсилають справжніх листів і не звертаються
 * до справжнього AWS S3 (ключі фіктивні, звернення до S3 у тестах підмінено).
 */

import { getTestDatabaseUrl } from './testDatabase.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = getTestDatabaseUrl();
process.env.JWT_SECRET = 'test_jwt_secret_for_automated_tests_only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.SMTP_HOST = '';
process.env.AWS_REGION = 'eu-north-1';
process.env.AWS_ACCESS_KEY_ID = 'AKIATESTONLY00000000';
process.env.AWS_SECRET_ACCESS_KEY = 'test_secret_access_key_for_automated_tests';
process.env.S3_BUCKET = 'test-bucket';
process.env.S3_PRESIGN_TTL = '3600';
process.env.MAX_UPLOAD_MB = '1';
