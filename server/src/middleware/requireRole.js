//ставиться після authenticate
import AppError from '../utils/AppError.js';

export default function requireRole(...roles) {
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
