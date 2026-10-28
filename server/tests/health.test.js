/**
 * @file Інтеграційні тести базових маршрутів API: перевірка працездатності та 404.
 */

import request from 'supertest';
import createApp from '../src/app.js';

const app = createApp();

describe('GET /api/health', () => {
  test('повертає status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('невідомий маршрут API', () => {
  test('повертає 404 у єдиному форматі помилки', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
