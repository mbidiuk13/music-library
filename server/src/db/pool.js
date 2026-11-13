import pg from 'pg';
import config from '../config/index.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

pool.on('error', (err) => {
  console.error("Помилка неактивного з'єднання з PostgreSQL:", err.message);
});

export function query(text, params = []) {
  return pool.query(text, params);
}

//усі запити транзакції мають іти через переданий `client`, а не через query()
export async function transaction(fn) {
  const client = await pool.connect();
  let brokenConnection;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    //якщо навіть ROLLBACK не вдався, з'єднання несправне — пул його закриє, а не перевикористає
    await client.query('ROLLBACK').catch((rollbackErr) => {
      brokenConnection = rollbackErr;
    });
    throw err;
  } finally {
    client.release(brokenConnection);
  }
}

export function assertDatabaseConfigured() {
  if (!config.databaseUrl) {
    throw new Error('Не задано DATABASE_URL у файлі .env (див. .env.example)');
  }
}

export function closePool() {
  return pool.end();
}
