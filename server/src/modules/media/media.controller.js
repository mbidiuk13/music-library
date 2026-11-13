import { GENRES, KEYS, MOODS } from '../../config/vocabularies.js';
import * as mediaService from './media.service.js';

function pickMetadata(body) {
  const { title, artist, genre, bpm, key_signature: keySignature, mood, year } = body;
  return { title, artist, genre, bpm, key_signature: keySignature, mood, year };
}

export async function searchTracks(req, res) {
  const { q, genre, limit, offset } = req.query;
  res.json(
    await mediaService.searchTracks({
      q: q || undefined,
      genre: genre || undefined,
      limit,
      offset,
    }),
  );
}

export async function getTrack(req, res) {
  res.json({ track: await mediaService.getTrack(req.params.id) });
}

export async function getStreamUrl(req, res) {
  res.json(await mediaService.getStreamUrl(req.params.id));
}

export async function registerPlay(req, res) {
  res.json(await mediaService.registerPlay(req.params.id, req.user?.id));
}

export function getVocabularies(req, res) {
  res.json({ genres: GENRES, moods: MOODS, keys: KEYS });
}

export async function listTracksForAdmin(req, res) {
  const { q, limit, offset } = req.query;
  res.json(await mediaService.listTracksForAdmin({ q: q || undefined, limit, offset }));
}

export async function createTrack(req, res) {
  const track = await mediaService.createTrack(pickMetadata(req.body), req.file);
  res.status(201).json({ track });
}

export async function updateTrack(req, res) {
  const track = await mediaService.updateTrack(req.params.id, pickMetadata(req.body));
  res.json({ track });
}

export async function deleteTrack(req, res) {
  await mediaService.deleteTrack(req.params.id);
  res.status(204).end();
}
