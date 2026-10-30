/**
 * @module modules/auth/auth.routes
 * @description Маршрути Auth Controller (`/api/auth/*`) і серверні правила валідації полів.
 * Ті самі правила дублюються на клієнті (форми реєстрації та входу).
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './auth.controller.js';
import { checkPassword } from './password.rules.js';

/** Максимальна довжина email і імені користувача (як у схемі БД). */
const EMAIL_MAX = 255;
const USERNAME_MAX = 100;

/**
 * Правило для поля email: рядок, коректний формат, зберігається в нижньому регістрі.
 * @returns {import('express-validator').ValidationChain} ланцюжок перевірок.
 */
const emailRule = () =>
  body('email')
    .isString()
    .withMessage('Введіть електронну пошту')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Введіть електронну пошту')
    .bail()
    .isLength({ max: EMAIL_MAX })
    .withMessage(`Електронна пошта не може бути довшою за ${EMAIL_MAX} символів`)
    .bail()
    .isEmail()
    .withMessage('Некоректна адреса електронної пошти')
    .bail()
    .toLowerCase();

/**
 * Правило для нового пароля (FR-2): див. modules/auth/password.rules.
 * @param {string} field - назва поля в тілі запиту.
 * @returns {import('express-validator').ValidationChain} ланцюжок перевірок.
 */
const newPasswordRule = (field) =>
  body(field).custom((value) => {
    const error = checkPassword(value);
    if (error) throw new Error(error);
    return true;
  });

/**
 * Правило для підтвердження пароля: має збігатися з полем `password`.
 * @returns {import('express-validator').ValidationChain} ланцюжок перевірок.
 */
const passwordConfirmRule = () =>
  body('passwordConfirm')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Паролі не збігаються');

const router = Router();

/**
 * Реєстрація (UC-1).
 * @route POST /api/auth/register
 */
router.post(
  '/register',
  emailRule(),
  body('username')
    .isString()
    .withMessage("Введіть ім'я")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Введіть ім'я")
    .bail()
    .isLength({ max: USERNAME_MAX })
    .withMessage(`Ім'я не може бути довшим за ${USERNAME_MAX} символів`),
  newPasswordRule('password'),
  passwordConfirmRule(),
  body('acceptTerms')
    .custom((value) => value === true)
    .withMessage('Потрібно погодитися з умовами використання'),
  validate,
  asyncHandler(controller.register),
);

/**
 * Вхід (UC-2).
 * @route POST /api/auth/login
 */
router.post(
  '/login',
  body('email')
    .isString()
    .withMessage('Введіть електронну пошту')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Введіть електронну пошту')
    .toLowerCase(),
  body('password')
    .isString()
    .withMessage('Введіть пароль')
    .bail()
    .notEmpty()
    .withMessage('Введіть пароль'),
  validate,
  asyncHandler(controller.login),
);

/**
 * Запит на відновлення пароля.
 * @route POST /api/auth/forgot-password
 */
router.post('/forgot-password', emailRule(), validate, asyncHandler(controller.forgotPassword));

/**
 * Встановлення нового пароля за токеном із листа.
 * @route POST /api/auth/reset-password
 */
router.post(
  '/reset-password',
  body('token')
    .isString()
    .withMessage('Посилання для відновлення пароля недійсне')
    .bail()
    .notEmpty()
    .withMessage('Посилання для відновлення пароля недійсне'),
  newPasswordRule('password'),
  passwordConfirmRule(),
  validate,
  asyncHandler(controller.resetPassword),
);

/**
 * Дані поточного користувача.
 * @route GET /api/auth/me
 */
router.get('/me', authenticate, asyncHandler(controller.me));

export default router;
