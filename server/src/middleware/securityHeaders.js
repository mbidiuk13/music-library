/**
 * @module middleware/securityHeaders
 * @description HTTP-заголовки безпеки (розділ 3.4 ПЗ) на основі helmet. Політика безпеки вмісту
 * (Content-Security-Policy) дозволяє браузеру завантажувати ресурси лише з власного домену, з двома
 * винятками: аудіо — з приватного бакета AWS S3 (за pre-signed URL, директива `media-src`)
 * і шрифт Inter — з Google Fonts (`style-src` для таблиці стилів, `font-src` для файлів шрифту).
 */

import helmet from 'helmet';

/** Джерело таблиці стилів Google Fonts (підключається в client/index.html). */
export const GOOGLE_FONTS_STYLES = 'https://fonts.googleapis.com';

/** Джерело файлів шрифтів Google Fonts. */
export const GOOGLE_FONTS_FILES = 'https://fonts.gstatic.com';

/**
 * Обчислює джерело (origin), з якого браузер отримує аудіо за pre-signed URL.
 * AWS SDK v3 формує посилання у віртуальному стилі `https://<бакет>.s3.<регіон>.amazonaws.com/<ключ>`;
 * для назв бакетів із крапкою (вони несумісні з TLS-сертифікатом `*.s3…`) — у стилі шляху
 * `https://s3.<регіон>.amazonaws.com/<бакет>/<ключ>`.
 * @param {{bucket: string, region: string}} s3 - назва бакета і регіон AWS із конфігурації.
 * @returns {string|null} джерело на кшталт `https://my-bucket.s3.eu-north-1.amazonaws.com`
 *   або `null`, якщо бакет чи регіон не задано.
 */
export function s3MediaOrigin({ bucket, region }) {
  if (!bucket || !region) return null;
  return bucket.includes('.')
    ? `https://s3.${region}.amazonaws.com`
    : `https://${bucket}.s3.${region}.amazonaws.com`;
}

/**
 * Формує директиви Content-Security-Policy застосунку.
 * @param {{bucket: string, region: string}} s3 - налаштування S3 (для `media-src`).
 * @returns {Record<string, string[]>} директиви у форматі helmet (`contentSecurityPolicy.directives`).
 */
export function buildCspDirectives(s3) {
  const mediaOrigin = s3MediaOrigin(s3);
  return {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'script-src': ["'self'"],
    'script-src-attr': ["'none'"],
    'style-src': ["'self'", GOOGLE_FONTS_STYLES],
    'font-src': ["'self'", GOOGLE_FONTS_FILES],
    'img-src': ["'self'", 'data:'],
    'connect-src': ["'self'"],
    'media-src': mediaOrigin ? ["'self'", mediaOrigin] : ["'self'"],
  };
}

/**
 * Створює middleware helmet з політикою безпеки вмісту застосунку.
 * Директива `upgrade-insecure-requests` не додається: HTTPS забезпечує nginx (deploy/nginx.conf),
 * а в локальному прод-режимі (`http://localhost`) вона ламала б завантаження ресурсів.
 * @param {{bucket: string, region: string}} s3 - налаштування S3 (для `media-src`).
 * @returns {import('express').RequestHandler} middleware заголовків безпеки.
 */
export default function securityHeaders(s3) {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: buildCspDirectives(s3),
    },
  });
}
