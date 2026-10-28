/**
 * @module server
 * @description Точка входу бекенду: створює Express-застосунок і запускає HTTP-сервер.
 */

import createApp from './app.js';
import config from './config/index.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`MusicLibrary API: http://localhost:${config.port} (${config.nodeEnv})`);
});
