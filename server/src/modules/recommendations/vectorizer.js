/*вектор треку (n = 46): one-hot для жанру, тональності й настрою + min-max нормалізовані bpm і year.
Усі компоненти невід'ємні, тому косинусна подібність лежить у [0; 1]*/
import { GENRES, KEYS, MOODS } from '../../config/vocabularies.js';

export const VECTOR_DIMENSION = GENRES.length + KEYS.length + MOODS.length + 2;

//значення поза словником дає нульовий вектор і не впливає на подібність
export function oneHot(value, vocabulary) {
  return vocabulary.map((item) => (item === value ? 1 : 0));
}

//norm(x) = (x − x_min) / (x_max − x_min); при x_max = x_min ознака не розрізняє треки — 0
export function minMax(x, min, max) {
  if (max === min) return 0;
  return (x - min) / (max - min);
}

//межі min-max рахуються по всій медіатеці
export function getNumericRanges(tracks) {
  if (tracks.length === 0) {
    return { bpm: { min: 0, max: 0 }, year: { min: 0, max: 0 } };
  }
  const bpms = tracks.map((track) => track.bpm);
  const years = tracks.map((track) => track.year);
  return {
    bpm: { min: Math.min(...bpms), max: Math.max(...bpms) },
    year: { min: Math.min(...years), max: Math.max(...years) },
  };
}

export function vectorizeTrack(track, ranges) {
  return [
    ...oneHot(track.genre, GENRES),
    ...oneHot(track.key_signature, KEYS),
    ...oneHot(track.mood, MOODS),
    minMax(track.bpm, ranges.bpm.min, ranges.bpm.max),
    minMax(track.year, ranges.year.min, ranges.year.max),
  ];
}
