/**
 * @file Підготовка змінних середовища перед кожним тестовим файлом (jest setupFiles).
 * Тести не залежать від локального .env: використовують фіксований тестовий ключ JWT
 * і ніколи не надсилають справжніх листів.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_automated_tests_only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.SMTP_HOST = '';
