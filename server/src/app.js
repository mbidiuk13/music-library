/**
 * @module app
 * @description Створення та налаштування Express-застосунку (без запуску HTTP-сервера,
 * щоб застосунок можна було тестувати через supertest).
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

/**
 * Створює екземпляр Express-застосунку з базовими заходами безпеки та маршрутами API.
 * @returns {import('express').Express} налаштований застосунок.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
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

  app.use('/api', notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
