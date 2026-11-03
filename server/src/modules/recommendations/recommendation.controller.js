/**
 * @module modules/recommendations/recommendation.controller
 * @description HTTP-обробники Recommendation Engine: викликають recommendation.service
 * і формують JSON-відповідь.
 */

import * as recommendationService from './recommendation.service.js';

/**
 * GET /api/recommendations/popular — Топ-100 треків за кількістю відтворень.
 * @param {import('express').Request} req - HTTP-запит (доступний усім).
 * @param {import('express').Response} res - 200 `{tracks}`.
 * @returns {Promise<void>}
 */
export async function getPopular(req, res) {
  res.json({ tracks: await recommendationService.getPopularTracks() });
}

/**
 * GET /api/recommendations/personal — персональні рекомендації (косинусна подібність).
 * @param {import('express').Request} req - HTTP-запит авторизованого користувача.
 * @param {import('express').Response} res - 200 `{source: "personal"|"popular", tracks}`.
 * @returns {Promise<void>}
 */
export async function getPersonal(req, res) {
  res.json(await recommendationService.getPersonalRecommendations(req.user.id));
}
