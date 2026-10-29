/**
 * @module db/seed-admin
 * @description Скрипт `npm run seed:admin`: створює обліковий запис адміністратора
 * з ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME у .env разом з його плейлистом «Улюблені»
 * (однією транзакцією, як при реєстрації). Пароль зберігається лише як bcrypt-хеш.
 * Повторний запуск оновлює ім'я, пароль і роль наявного запису з тим самим email.
 */

import bcrypt from 'bcrypt';
import config from '../config/index.js';
import { transaction } from './pool.js';
import { runDbScript } from './sqlFile.js';

/**
 * Створює або оновлює адміністратора та гарантує наявність його плейлиста «Улюблені».
 * @returns {Promise<void>}
 * @throws {Error} якщо ADMIN_EMAIL або ADMIN_PASSWORD не задано в .env.
 */
async function seedAdmin() {
  const { email, password, username } = config.admin;
  if (!email || !password) {
    throw new Error('задайте ADMIN_EMAIL і ADMIN_PASSWORD у файлі .env');
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);

  const admin = await transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (email, username, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO UPDATE
         SET username = EXCLUDED.username,
             password_hash = EXCLUDED.password_hash,
             role = 'admin'
       RETURNING id, email, (xmax = 0) AS created`,
      [email.trim().toLowerCase(), username, passwordHash],
    );
    await client.query(
      `INSERT INTO playlist (user_id, title) VALUES ($1, $2)
       ON CONFLICT (user_id, title) DO NOTHING`,
      [rows[0].id, config.favoritesTitle],
    );
    return rows[0];
  });

  console.log(`Адміністратора ${admin.created ? 'створено' : 'оновлено'}: ${admin.email}`);
}

await runDbScript(seedAdmin);
