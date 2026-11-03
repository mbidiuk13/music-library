/**
 * @module modules/recommendations/vectorizer
 * @description Векторизація треку для Recommendation Engine (розділ 3.3.1 ПЗ).
 * Кожен трек перетворюється на числовий вектор розмірності n = 12 + 24 + 8 + 2 = 46:
 *
 *   B = [ one-hot(genre, GENRES) | one-hot(key_signature, KEYS) | one-hot(mood, MOODS) | norm(bpm) | norm(year) ]
 *
 * де категоріальні ознаки кодуються one-hot, а числові нормалізуються методом min-max
 * за діапазоном значень у всій медіатеці:
 *
 *   norm(x) = (x − x_min) / (x_max − x_min),   norm(x) = 0, якщо x_max = x_min.
 *
 * Усі компоненти вектора невід'ємні (0 або 1 для one-hot, [0; 1] для min-max), тому
 * косинусна подібність двох таких векторів лежить у межах [0; 1].
 * Модуль містить лише чисті функції без доступу до БД.
 */

import { GENRES, KEYS, MOODS } from '../../config/vocabularies.js';

/** Розмірність вектора треку: жанри (12) + тональності (24) + настрої (8) + bpm + year = 46. */
export const VECTOR_DIMENSION = GENRES.length + KEYS.length + MOODS.length + 2;

/**
 * One-hot кодування категоріального значення: вектор довжини |vocabulary|,
 * у якому 1 стоїть лише на позиції значення у словнику, а решта — 0.
 *   one-hot(v, V)_i = 1, якщо V_i = v;  0 — інакше.
 * Значення поза словником кодується нульовим вектором (не впливає на подібність).
 * @param {string} value - значення ознаки (напр. жанр `"Поп"`).
 * @param {readonly string[]} vocabulary - фіксований словник значень ознаки.
 * @returns {number[]} вектор із нулів і не більше ніж однієї одиниці.
 */
export function oneHot(value, vocabulary) {
  return vocabulary.map((item) => (item === value ? 1 : 0));
}

/**
 * Min-max нормалізація числа до відрізка [0; 1]:
 *   norm(x) = (x − x_min) / (x_max − x_min).
 * Якщо x_max = x_min (усі треки мають однакове значення), ознака не розрізняє треки,
 * тому повертається 0 (без ділення на нуль).
 * @param {number} x - значення ознаки.
 * @param {number} min - мінімальне значення ознаки в медіатеці (x_min).
 * @param {number} max - максимальне значення ознаки в медіатеці (x_max).
 * @returns {number} нормалізоване значення з [0; 1].
 */
export function minMax(x, min, max) {
  if (max === min) return 0;
  return (x - min) / (max - min);
}

/**
 * Обчислює діапазони числових ознак (bpm_min/bpm_max, year_min/year_max) по всій медіатеці.
 * @param {Array<{bpm: number, year: number}>} tracks - усі треки медіатеки.
 * @returns {{bpm: {min: number, max: number}, year: {min: number, max: number}}} межі ознак;
 *   для порожнього списку — нульові межі.
 */
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

/**
 * Перетворює трек на вектор ознак розмірності 46:
 *   B = [ one-hot(genre) | one-hot(key_signature) | one-hot(mood) | norm(bpm) | norm(year) ].
 * @param {{genre: string, key_signature: string, mood: string, bpm: number, year: number}} track - метадані треку.
 * @param {{bpm: {min: number, max: number}, year: {min: number, max: number}}} ranges - діапазони
 *   числових ознак у медіатеці (див. getNumericRanges).
 * @returns {number[]} вектор треку з невід'ємними компонентами.
 */
export function vectorizeTrack(track, ranges) {
  return [
    ...oneHot(track.genre, GENRES),
    ...oneHot(track.key_signature, KEYS),
    ...oneHot(track.mood, MOODS),
    minMax(track.bpm, ranges.bpm.min, ranges.bpm.max),
    minMax(track.year, ranges.year.min, ranges.year.max),
  ];
}
