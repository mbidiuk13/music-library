/**
 * @module middleware/requireRole
 * @description Рольова модель доступу (RBAC, розділ 3.4 ПЗ). Роль береться з перевіреного
 * JWT (`req.user.role`), тому middleware ставиться після `authenticate`. Приховування пунктів
 * меню на клієнті — лише зручність, а захист виконується тут, на сервері.
 */

import AppError from '../utils/AppError.js';

/**
 * Створює middleware, що пропускає лише користувачів з однією з дозволених ролей.
 * @param {...('user'|'admin')} roles - дозволені ролі, напр. `requireRole('admin')`.
 * @returns {import('express').RequestHandler} middleware перевірки ролі.
 */
export default function requireRole(...roles) {
  /**
   * Перевіряє роль поточного користувача.
   * @param {import('express').Request} req - HTTP-запит (з `req.user` від authenticate).
   * @param {import('express').Response} res - HTTP-відповідь.
   * @param {import('express').NextFunction} next - наступний middleware.
   * @returns {void}
   */
  return function checkRole(req, res, next) {
    if (!req.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Потрібна авторизація'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, 'FORBIDDEN', 'Недостатньо прав доступу'));
      return;
    }
    next();
  };
}
