import { query } from '../../db/pool.js';

const PUBLIC_COLUMNS = 'id, email, username, role, created_at';

export async function findUserByEmail(email) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = $1`,
    [email],
  );
  return rows[0];
}

export async function findUserById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE id = $1`, [
    id,
  ]);
  return rows[0];
}

//умова на старий хеш робить токен відновлення одноразовим навіть при двох одночасних запитах
export async function updatePasswordHash(id, expectedHash, newHash) {
  const { rowCount } = await query(
    'UPDATE users SET password_hash = $3 WHERE id = $1 AND password_hash = $2',
    [id, expectedHash, newHash],
  );
  return rowCount === 1;
}

export async function insertUser(client, { email, username, passwordHash }) {
  const { rows } = await client.query(
    `INSERT INTO users (email, username, password_hash)
     VALUES ($1, $2, $3)
     RETURNING ${PUBLIC_COLUMNS}`,
    [email, username, passwordHash],
  );
  return rows[0];
}

export async function insertPlaylist(client, userId, title) {
  await client.query('INSERT INTO playlist (user_id, title) VALUES ($1, $2)', [userId, title]);
}
