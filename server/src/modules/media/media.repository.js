import { query } from '../../db/pool.js';

const PUBLIC_COLUMNS = 'id, title, artist, genre, bpm, key_signature, mood, year, play_count';

const ADMIN_COLUMNS = `${PUBLIC_COLUMNS}, s3_key, created_at`;

//екранує спецсимволи LIKE (`\`, `%`, `_`), щоб у пошуку вони збігалися як звичайні символи
export function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

export async function findTrackById(id) {
  const { rows } = await query(`SELECT ${ADMIN_COLUMNS} FROM track WHERE id = $1`, [id]);
  return rows[0];
}

export async function searchTracks({ q, genre, limit, offset }) {
  const pattern = q ? `%${escapeLike(q)}%` : null;
  const where = `WHERE ($1::text IS NULL
      OR title ILIKE $1 ESCAPE '\\' OR artist ILIKE $1 ESCAPE '\\' OR genre ILIKE $1 ESCAPE '\\')
    AND ($2::text IS NULL OR genre = $2)`;

  const [list, count] = await Promise.all([
    query(
      `SELECT ${PUBLIC_COLUMNS} FROM track ${where}
       ORDER BY play_count DESC, title, id
       LIMIT $3 OFFSET $4`,
      [pattern, genre ?? null, limit, offset],
    ),
    query(`SELECT COUNT(*)::int AS total FROM track ${where}`, [pattern, genre ?? null]),
  ]);
  return { tracks: list.rows, total: count.rows[0].total };
}

//пошук за початком id (адмін-таблиця показує перші 8 символів UUID) або підрядком назви
export async function listTracksForAdmin({ q, limit, offset }) {
  const titlePattern = q ? `%${escapeLike(q)}%` : null;
  const idPattern = q ? `${escapeLike(q)}%` : null;
  const where = `WHERE $1::text IS NULL OR title ILIKE $1 ESCAPE '\\' OR id::text ILIKE $2 ESCAPE '\\'`;

  const [list, count] = await Promise.all([
    query(
      `SELECT ${ADMIN_COLUMNS} FROM track ${where}
       ORDER BY created_at DESC, id
       LIMIT $3 OFFSET $4`,
      [titlePattern, idPattern, limit, offset],
    ),
    query(`SELECT COUNT(*)::int AS total FROM track ${where}`, [titlePattern, idPattern]),
  ]);
  return { tracks: list.rows, total: count.rows[0].total };
}

export async function insertTrack(track) {
  const { rows } = await query(
    `INSERT INTO track (id, title, artist, genre, bpm, key_signature, mood, year, s3_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${ADMIN_COLUMNS}`,
    [
      track.id,
      track.title,
      track.artist,
      track.genre,
      track.bpm,
      track.key_signature,
      track.mood,
      track.year,
      track.s3_key,
    ],
  );
  return rows[0];
}

export async function updateTrack(id, metadata) {
  const { rows } = await query(
    `UPDATE track
     SET title = $2, artist = $3, genre = $4, bpm = $5, key_signature = $6, mood = $7, year = $8
     WHERE id = $1
     RETURNING ${ADMIN_COLUMNS}`,
    [
      id,
      metadata.title,
      metadata.artist,
      metadata.genre,
      metadata.bpm,
      metadata.key_signature,
      metadata.mood,
      metadata.year,
    ],
  );
  return rows[0];
}

export async function incrementPlayCount(client, id) {
  const { rows } = await client.query(
    'UPDATE track SET play_count = play_count + 1 WHERE id = $1 RETURNING play_count',
    [id],
  );
  return rows[0]?.play_count;
}

//якщо користувача вже видалено (а токен ще дійсний), запис не додається
export async function insertListen(client, userId, trackId) {
  await client.query(
    `INSERT INTO user_listen_history (user_id, track_id)
     SELECT $1::uuid, $2::uuid
     WHERE EXISTS (SELECT 1 FROM users WHERE id = $1::uuid)`,
    [userId, trackId],
  );
}

//рядки playlist_track і user_listen_history видаляються каскадно (ON DELETE CASCADE)
export async function deleteTrack(client, id) {
  const { rows } = await client.query('DELETE FROM track WHERE id = $1 RETURNING s3_key', [id]);
  return rows[0]?.s3_key;
}
