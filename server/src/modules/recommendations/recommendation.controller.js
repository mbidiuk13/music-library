import * as recommendationService from './recommendation.service.js';

export async function getPopular(req, res) {
  res.json({ tracks: await recommendationService.getPopularTracks() });
}

export async function getPersonal(req, res) {
  res.json(await recommendationService.getPersonalRecommendations(req.user.id));
}
