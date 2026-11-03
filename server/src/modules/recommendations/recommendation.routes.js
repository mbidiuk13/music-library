/**
 * @module modules/recommendations/recommendation.routes
 * @description Маршрути Recommendation Engine (`/api/recommendations`): Топ-100 для всіх
 * і персональні рекомендації лише для авторизованих користувачів.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './recommendation.controller.js';

/** Маршрути рекомендацій: `/api/recommendations`. */
const recommendationRouter = Router();

/**
 * Топ-100 треків за кількістю відтворень (блок «Популярне»).
 * @route GET /api/recommendations/popular
 */
recommendationRouter.get('/popular', asyncHandler(controller.getPopular));

/**
 * Персональні рекомендації («Підібрано для вас»); при k < M — резервний Топ-100.
 * @route GET /api/recommendations/personal
 */
recommendationRouter.get('/personal', authenticate, asyncHandler(controller.getPersonal));

export default recommendationRouter;
