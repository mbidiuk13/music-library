//серверні правила валідації дублюють клієнтські (форми реєстрації та входу)
import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './auth.controller.js';
import { checkPassword } from './password.rules.js';

const EMAIL_MAX = 255;
const USERNAME_MAX = 100;

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

const newPasswordRule = (field) =>
  body(field).custom((value) => {
    const error = checkPassword(value);
    if (error) throw new Error(error);
    return true;
  });

const passwordConfirmRule = () =>
  body('passwordConfirm')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Паролі не збігаються');

//тут лише непорожній рядок; сам токен перевіряє auth.service
const resetTokenRule = () =>
  body('token')
    .isString()
    .withMessage('Посилання для відновлення пароля недійсне')
    .bail()
    .notEmpty()
    .withMessage('Посилання для відновлення пароля недійсне');

const router = Router();

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
  validate,
  asyncHandler(controller.register),
);

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

router.post('/forgot-password', emailRule(), validate, asyncHandler(controller.forgotPassword));

//перевірка посилання перед показом форми, без змін у БД
router.post(
  '/reset-password/verify',
  resetTokenRule(),
  validate,
  asyncHandler(controller.verifyResetToken),
);

router.post(
  '/reset-password',
  resetTokenRule(),
  newPasswordRule('password'),
  passwordConfirmRule(),
  validate,
  asyncHandler(controller.resetPassword),
);

router.get('/me', authenticate, asyncHandler(controller.me));

export default router;
