/**
 * @file Підготовка змінних середовища перед кожним тестовим файлом (jest setupFiles).
 * Тести не залежать від локального .env: використовують фіксований тестовий ключ JWT,
 * лише тестову БД (TEST_DATABASE_URL) і ніколи не надсилають справжніх листів.
 */

import { getTestDatabaseUrl } from './testDatabase.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = getTestDatabaseUrl();
process.env.JWT_SECRET = 'test_jwt_secret_for_automated_tests_only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.SMTP_HOST = '';
