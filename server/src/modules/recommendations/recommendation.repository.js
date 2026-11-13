//метадані треків щоразу читаються з БД без кешу векторів, тож правки адміністратора враховуються одразу
import { query } from '../../db/pool.js';

//без s3_key
const PUBLIC_COLUMNS = 'id, title, artist, genre, bpm, key_signature, mood, year, play_count';

export async function findPopularTracks(limit) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM track
     ORDER BY play_count DESC, title, id
     LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function findListenedTrackIds(userId) {
  const { rows } = await query(
    'SELECT DISTINCT track_id FROM user_listen_history WHERE user_id = $1',
    [userId],
  );
  return rows.map((row) => row.track_id);
}

export async function findAllTracks() {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM track`);
  return rows;
}
