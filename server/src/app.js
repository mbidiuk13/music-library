/**
 * @module app
 * @description Створення та налаштування Express-застосунку (без запуску HTTP-сервера,
 * щоб застосунок можна було тестувати через supertest).
 */

import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import securityHeaders from './middleware/securityHeaders.js';
import clientApp from './middleware/clientApp.js';
import { authenticate } from './middleware/auth.js';
import requireRole from './middleware/requireRole.js';
import authRoutes from './modules/auth/auth.routes.js';
import { adminTrackRouter, metaRouter, trackRouter } from './modules/media/media.routes.js';
import { favoritesRouter, playlistRouter } from './modules/playlists/playlists.routes.js';
import recommendationRoutes from './modules/recommendations/recommendation.routes.js';

/**
 * Створює екземпляр Express-застосунку з базовими заходами безпеки та маршрутами API.
 * У продакшені (NODE_ENV=production) той самий застосунок роздає і зібраний React-клієнт.
 * @param {object} [options] - параметри створення.
 * @param {string|null} [options.clientDist] - тека зі збіркою клієнта, яку треба роздавати;
 *   за замовчуванням `config.clientDist` у продакшені і `null` (лише API) в інших режимах.
 * @returns {import('express').Express} налаштований застосунок.
 * @throws {Error} якщо роздачу клієнта ввімкнено, а збірки немає.
 */
export function createApp({ clientDist = config.isProduction ? config.clientDist : null } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(securityHeaders(config.s3));
  app.use(cors({ origin: config.clientUrl }));
  app.use(express.json({ limit: '100kb' }));

  /**
   * Перевірка працездатності сервера.
   * @route GET /api/health
   * @returns {{status: string}} `{ status: "ok" }`.
   */
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/tracks', trackRouter);
  app.use('/api/meta', metaRouter);
  app.use('/api/playlists', playlistRouter);
  app.use('/api/favorites', favoritesRouter);
  app.use('/api/recommendations', recommendationRoutes);

  // Усі адміністративні маршрути (/api/admin/*) — лише для ролі admin (RBAC, розділ 3.4 ПЗ).
  app.use('/api/admin', authenticate, requireRole('admin'));
  app.use('/api/admin/tracks', adminTrackRouter);

  app.use('/api', notFound);
  if (clientDist) app.use(clientApp(clientDist));
  app.use(errorHandler);

  return app;
}

export default createApp;
