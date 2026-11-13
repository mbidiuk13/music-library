import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './recommendation.controller.js';

const recommendationRouter = Router();

recommendationRouter.get('/popular', asyncHandler(controller.getPopular));

recommendationRouter.get('/personal', authenticate, asyncHandler(controller.getPersonal));

export default recommendationRouter;
