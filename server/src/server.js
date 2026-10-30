/**
 * @module server
 * @description Точка входу бекенду: створює Express-застосунок і запускає HTTP-сервер.
 */

import createApp from './app.js';
import config from './config/index.js';
import { getJwtSecret } from './utils/jwt.js';

// Без ключа підпису JWT автентифікація неможлива — зупиняємо запуск з поясненням.
try {
  getJwtSecret();
} catch (err) {
  console.error(`Помилка: ${err.message}`);
  process.exit(1);
}

const app = createApp();

app.listen(config.port, () => {
  console.log(`MusicLibrary API: http://localhost:${config.port} (${config.nodeEnv})`);
});
