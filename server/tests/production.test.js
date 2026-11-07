/**
 * @file Тести прод-режиму: заголовки безпеки (Content-Security-Policy для аудіо з S3 і шрифту
 * Google Fonts) і роздача зібраного клієнта сервером Express.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import createApp from '../src/app.js';
import { buildCspDirectives, s3MediaOrigin } from '../src/middleware/securityHeaders.js';

/**
 * Розбирає заголовок Content-Security-Policy на директиви.
 * @param {string} header - значення заголовка.
 * @returns {Record<string, string[]>} директиви та їхні джерела.
 */
function parseCsp(header) {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name, sources]),
  );
}

describe('s3MediaOrigin', () => {
  test('віртуальний стиль адреси для звичайної назви бакета', () => {
    expect(s3MediaOrigin({ bucket: 'my-bucket', region: 'eu-north-1' })).toBe(
      'https://my-bucket.s3.eu-north-1.amazonaws.com',
    );
  });

  test('стиль шляху для назви бакета з крапкою', () => {
    expect(s3MediaOrigin({ bucket: 'my.bucket', region: 'eu-north-1' })).toBe(
      'https://s3.eu-north-1.amazonaws.com',
    );
  });

  test('null, якщо бакет не задано', () => {
    expect(s3MediaOrigin({ bucket: '', region: 'eu-north-1' })).toBeNull();
  });
});

describe('buildCspDirectives', () => {
  test('без бакета аудіо дозволене лише з власного домену', () => {
    expect(buildCspDirectives({ bucket: '', region: 'eu-north-1' })['media-src']).toEqual([
      "'self'",
    ]);
  });
});

describe('заголовок Content-Security-Policy', () => {
  const app = createApp();

  test('дозволяє аудіо з бакета S3 і шрифт Google Fonts, решту — лише з власного домену', async () => {
    const res = await request(app).get('/api/health');
    const csp = parseCsp(res.headers['content-security-policy']);

    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['script-src']).toEqual(["'self'"]);
    expect(csp['media-src']).toEqual(["'self'", 'https://test-bucket.s3.eu-north-1.amazonaws.com']);
    expect(csp['style-src']).toContain('https://fonts.googleapis.com');
    expect(csp['font-src']).toContain('https://fonts.gstatic.com');
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp).not.toHaveProperty('upgrade-insecure-requests');
  });
});

describe('роздача зібраного клієнта', () => {
  let distDir;
  let app;

  beforeAll(() => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'music-library-dist-'));
    fs.mkdirSync(path.join(distDir, 'assets'));
    fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><div id="root"></div>');
    fs.writeFileSync(path.join(distDir, 'assets', 'index-abc123.js'), 'console.log(1);');
    app = createApp({ clientDist: distDir });
  });

  afterAll(() => {
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  test('головна сторінка — index.html', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<div id="root">');
  });

  test('маршрут SPA (/playlists/…) теж повертає index.html', async () => {
    const res = await request(app).get('/playlists/123');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });

  test('файли збірки віддаються з довгим кешуванням', async () => {
    const res = await request(app).get('/assets/index-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.headers['cache-control']).toMatch(/immutable/);
  });

  test('невідомий маршрут API — і далі JSON 404, а не index.html', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('API працює поряд із клієнтом', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('без збірки клієнта застосунок не створюється', () => {
    expect(() => createApp({ clientDist: path.join(distDir, 'missing') })).toThrow(/npm run build/);
  });
});
