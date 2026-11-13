import AppError from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';

function extractBearerToken(req) {
  const header = req.get('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

function userFromToken(token) {
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AppError(
      401,
      'INVALID_TOKEN',
      'Сесія недійсна або завершилася. Увійдіть до системи знову',
    );
  }
  return { id: payload.sub, role: payload.role, email: payload.email };
}

export function authenticate(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Потрібна авторизація'));
    return;
  }
  try {
    req.user = userFromToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

//недійсний чи прострочений токен не блокує публічний ресурс — запит обробляється як від гостя
export function optionalAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (token) {
    try {
      req.user = userFromToken(token);
    } catch {
      req.user = undefined;
    }
  }
  next();
}
