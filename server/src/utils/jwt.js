import jwt from 'jsonwebtoken';
import config from '../config/index.js';

//єдиний дозволений алгоритм підпису — захист від підміни алгоритму в заголовку токена
const ALGORITHM = 'HS256';

export function getJwtSecret() {
  if (!config.jwt.secret) {
    throw new Error('Не задано JWT_SECRET у файлі .env (див. .env.example)');
  }
  return config.jwt.secret;
}

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, getJwtSecret(), {
    algorithm: ALGORITHM,
    expiresIn: config.jwt.expiresIn,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret(), { algorithms: [ALGORITHM] });
}

const RESET_PURPOSE = 'reset';

/*ключ — JWT_SECRET + поточний хеш пароля: після зміни пароля токен стає недійсним (одноразовий,
строк дії 15 хв) без окремої таблиці токенів*/
export function signPasswordResetToken(user) {
  return jwt.sign({ sub: user.id, purpose: RESET_PURPOSE }, getJwtSecret() + user.password_hash, {
    algorithm: ALGORITHM,
    expiresIn: config.jwt.passwordResetExpiresIn,
  });
}

//читає `sub` БЕЗ перевірки підпису — лише щоб знайти користувача, чий хеш потрібен для перевірки
export function readTokenSubject(token) {
  const payload = jwt.decode(token);
  return payload && typeof payload.sub === 'string' ? payload.sub : null;
}

export function verifyPasswordResetToken(token, passwordHash) {
  const payload = jwt.verify(token, getJwtSecret() + passwordHash, { algorithms: [ALGORITHM] });
  if (payload.purpose !== RESET_PURPOSE) {
    throw new jwt.JsonWebTokenError('Токен не призначений для відновлення пароля');
  }
  return payload;
}
