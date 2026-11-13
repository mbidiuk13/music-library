import { pool, query } from '../../db/pool.js';

//без s3_key: його не віддаємо клієнту
const TRACK_COLUMNS =
  't.id, t.title, t.artist, t.genre, t.bpm, t.key_signature, t.mood, t.year, t.play_count';

const PLAYLIST_COLUMNS = 'p.id, p.title, p.created_at, COUNT(pt.track_id)::int AS track_count';

//hasTrack — підзапитом EXISTS у тому ж запиті, а не окремим запитом на кожен плейлист
export async function listPlaylists(userId, favoritesTitle, trackId) {
  const params = [userId, favoritesTitle];
  let hasTrackColumn = '';
  if (trackId) {
    params.push(trackId);
    hasTrackColumn = `,
       EXISTS (
         SELECT 1 FROM playlist_track m WHERE m.playlist_id = p.id AND m.track_id = $3
       ) AS "hasTrack"`;
  }
  const { rows } = await query(
    `SELECT ${PLAYLIST_COLUMNS}${hasTrackColumn}
     FROM playlist p
     LEFT JOIN playlist_track pt ON pt.playlist_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id
     ORDER BY p.title = $2 DESC, p.created_at, p.title`,
    params,
  );
  return rows;
}

export async function findPlaylist(id, userId) {
  const { rows } = await query(
    `SELECT ${PLAYLIST_COLUMNS}
     FROM playlist p
     LEFT JOIN playlist_track pt ON pt.playlist_id = p.id
     WHERE p.id = $1 AND p.user_id = $2
     GROUP BY p.id`,
    [id, userId],
  );
  return rows[0];
}

export async function insertPlaylist(userId, title, db = pool) {
  const { rows } = await db.query(
    'INSERT INTO playlist (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at',
    [userId, title],
  );
  return rows[0];
}

export async function renamePlaylist(id, userId, title) {
  const { rows } = await query(
    `UPDATE playlist SET title = $3
     WHERE id = $1 AND user_id = $2
     RETURNING id, title, created_at`,
    [id, userId, title],
  );
  return rows[0];
}

//рядки playlist_track видаляються каскадно (ON DELETE CASCADE); треки лишаються в медіатеці
export async function deletePlaylist(id, userId) {
  const { rowCount } = await query('DELETE FROM playlist WHERE id = $1 AND user_id = $2', [
    id,
    userId,
  ]);
  return rowCount > 0;
}

//тут і нижче без умови user_id: належність плейлиста вже перевірив сервіс
export async function listPlaylistTracks(playlistId) {
  const { rows } = await query(
    `SELECT ${TRACK_COLUMNS}, pt.added_at
     FROM playlist_track pt
     JOIN track t ON t.id = pt.track_id
     WHERE pt.playlist_id = $1
     ORDER BY pt.added_at, t.title, t.id`,
    [playlistId],
  );
  return rows;
}

export async function insertPlaylistTrack(playlistId, trackId, db = pool) {
  const { rows } = await db.query(
    `WITH added AS (
       INSERT INTO playlist_track (playlist_id, track_id) VALUES ($1, $2)
       RETURNING track_id, added_at
     )
     SELECT ${TRACK_COLUMNS}, added.added_at
     FROM added
     JOIN track t ON t.id = added.track_id`,
    [playlistId, trackId],
  );
  return rows[0];
}

export async function deletePlaylistTrack(playlistId, trackId) {
  const { rowCount } = await query(
    'DELETE FROM playlist_track WHERE playlist_id = $1 AND track_id = $2',
    [playlistId, trackId],
  );
  return rowCount > 0;
}

export async function findPlaylistIdByTitle(userId, title) {
  const { rows } = await query('SELECT id FROM playlist WHERE user_id = $1 AND title = $2', [
    userId,
    title,
  ]);
  return rows[0]?.id;
}

export async function listTrackIdsByPlaylistTitle(userId, title) {
  const { rows } = await query(
    `SELECT pt.track_id
     FROM playlist_track pt
     JOIN playlist p ON p.id = pt.playlist_id
     WHERE p.user_id = $1 AND p.title = $2
     ORDER BY pt.added_at, pt.track_id`,
    [userId, title],
  );
  return rows.map((row) => row.track_id);
}
