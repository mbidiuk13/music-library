/**
 * @module middleware/clientApp
 * @description Роздача зібраного React-клієнта (`client/dist`) у продакшені. Один процес Node.js
 * обслуговує і REST API (`/api/*`), і SPA — «монолітний бекенд» з ПЗ. Для маршрутів клієнта
 * (`/search`, `/playlists/…`) повертається `index.html`, далі шлях обробляє React Router.
 */

import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';

/** Строк кешування файлів з хешем у назві (`assets/*`): рік, вони незмінні. */
const ASSETS_MAX_AGE = '1y';

/**
 * Створює маршрутизатор, що роздає статичні файли клієнта і повертає `index.html`
 * для всіх GET-запитів поза `/api`.
 * @param {string} distDir - абсолютний шлях до теки зі збіркою клієнта (`client/dist`).
 * @returns {import('express').Router} маршрутизатор клієнта.
 * @throws {Error} якщо в `distDir` немає `index.html` (клієнт не зібрано: `npm run build`).
 */
export default function clientApp(distDir) {
  const indexFile = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexFile)) {
    throw new Error(`Не знайдено збірку клієнта (${indexFile}). Виконайте npm run build.`);
  }

  const router = Router();

  router.use(
    '/assets',
    express.static(path.join(distDir, 'assets'), { immutable: true, maxAge: ASSETS_MAX_AGE }),
  );
  router.use(express.static(distDir, { index: false }));

  /**
   * Повертає index.html для маршрутів SPA (усі GET/HEAD-запити поза `/api`).
   * @param {import('express').Request} req - HTTP-запит.
   * @param {import('express').Response} res - HTTP-відповідь.
   * @returns {void}
   */
  router.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });

  return router;
}
