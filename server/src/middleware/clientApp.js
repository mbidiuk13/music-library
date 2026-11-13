//у продакшені один процес Node.js роздає і API, і зібраний SPA (`client/dist`)
import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';

//файли в assets/ мають хеш у назві й не змінюються
const ASSETS_MAX_AGE = '1y';

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

  //маршрути клієнта поза /api віддають index.html, далі шлях обробляє React Router
  router.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });

  return router;
}
