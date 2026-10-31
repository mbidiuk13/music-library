/**
 * @file Допоміжні дані й функції для тестів Media Service: коректні метадані,
 * мінімальні «аудіофайли» з правильною сигнатурою і додавання треків у тестову БД.
 */

import { randomUUID } from 'node:crypto';
import { query } from '../../src/db/pool.js';

/** Найменший вміст, який проходить перевірку сигнатури MP3 (тег ID3). */
export const MP3_BYTES = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(64)]);

/** Найменший вміст, який проходить перевірку сигнатури WAV (RIFF…WAVE). */
export const WAV_BYTES = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WAVE'),
  Buffer.alloc(32),
]);

/**
 * Формує коректні метадані треку; окремі поля можна перевизначити.
 * @param {object} [overrides] - поля, які треба замінити.
 * @returns {object} метадані: title, artist, genre, bpm, key_signature, mood, year.
 */
export function trackMetadata(overrides = {}) {
  return {
    title: 'Тестовий трек',
    artist: 'Тестовий виконавець',
    genre: 'Поп',
    bpm: 120,
    key_signature: 'A minor',
    mood: 'енергійний',
    year: 2024,
    ...overrides,
  };
}

/**
 * Додає трек безпосередньо в тестову БД (без S3).
 * @param {object} [overrides] - поля треку, які треба замінити (зокрема play_count).
 * @returns {Promise<object>} створений рядок таблиці track.
 */
export async function insertTestTrack(overrides = {}) {
  const track = {
    ...trackMetadata(),
    s3_key: `tracks/${randomUUID()}.mp3`,
    play_count: 0,
    ...overrides,
  };
  const { rows } = await query(
    `INSERT INTO track (title, artist, genre, bpm, key_signature, mood, year, s3_key, play_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      track.title,
      track.artist,
      track.genre,
      track.bpm,
      track.key_signature,
      track.mood,
      track.year,
      track.s3_key,
      track.play_count,
    ],
  );
  return rows[0];
}
