import bcrypt from 'bcrypt';
import config from '../../config/index.js';
import { transaction } from '../../db/pool.js';
import mailer from '../../services/mailer.js';
import AppError from '../../utils/AppError.js';
import {
  readTokenSubject,
  signAccessToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
} from '../../utils/jwt.js';
import * as repository from './auth.repository.js';

const UNIQUE_VIOLATION = '23505';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*bcrypt.compare виконується завжди, навіть для неіснуючого email, щоб за часом відповіді
не можна було визначити, чи зареєстровано адресу*/
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equalizer-password', config.bcryptSaltRounds);

export function toPublicUser(user) {
  return { id: user.id, email: user.email, username: user.username, role: user.role };
}

//користувач і плейлист «Улюблені» створюються в одній транзакції
export async function register({ email, username, password }) {
  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);

  let user;
  try {
    user = await transaction(async (client) => {
      const created = await repository.insertUser(client, { email, username, passwordHash });
      await repository.insertPlaylist(client, created.id, config.favoritesTitle);
      return created;
    });
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION && err.constraint === 'users_email_key') {
      throw new AppError(
        409,
        'EMAIL_TAKEN',
        'Користувач з такою електронною поштою вже зареєстрований',
      );
    }
    throw err;
  }

  return { token: signAccessToken(user), user: toPublicUser(user) };
}

//для неіснуючого email і хибного пароля — однакова помилка
export async function login({ email, password }) {
  const user = await repository.findUserByEmail(email);
  const passwordMatches = await bcrypt.compare(
    password,
    user ? user.password_hash : DUMMY_PASSWORD_HASH,
  );
  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Невірний логін або пароль');
  }
  return { token: signAccessToken(user), user: toPublicUser(user) };
}

export async function getCurrentUser(userId) {
  const user = await repository.findUserById(userId);
  if (!user) {
    throw new AppError(
      401,
      'INVALID_TOKEN',
      'Сесія недійсна або завершилася. Увійдіть до системи знову',
    );
  }
  return toPublicUser(user);
}

function invalidResetToken() {
  return new AppError(
    400,
    'INVALID_RESET_TOKEN',
    'Посилання для відновлення пароля недійсне або його строк дії минув',
  );
}

/*для незареєстрованого email нічого не робить, щоб відповідь не розкривала існування акаунта.
Лист іде у фоні, щоб час відповіді не залежав від поштового сервера*/
export async function requestPasswordReset(email) {
  const user = await repository.findUserByEmail(email);
  if (!user) return;

  const token = signPasswordResetToken(user);
  const link = `${config.clientUrl}/reset-password?token=${encodeURIComponent(token)}`;
  mailer
    .sendPasswordResetEmail({ to: user.email, username: user.username, link })
    .catch((err) =>
      console.error('Не вдалося надіслати лист для відновлення пароля:', err.message),
    );
}

async function findResetTokenOwner(token) {
  const userId = readTokenSubject(token);
  if (!userId || !UUID_PATTERN.test(userId)) throw invalidResetToken();

  const user = await repository.findUserById(userId);
  if (!user) throw invalidResetToken();
  try {
    verifyPasswordResetToken(token, user.password_hash);
  } catch {
    throw invalidResetToken();
  }
  return user;
}

export async function verifyResetToken(token) {
  await findResetTokenOwner(token);
}

//токен одноразовий: після зміни пароля змінюється хеш, яким він підписаний
export async function resetPassword({ token, password }) {
  const user = await findResetTokenOwner(token);

  const newHash = await bcrypt.hash(password, config.bcryptSaltRounds);
  const changed = await repository.updatePasswordHash(user.id, user.password_hash, newHash);
  if (!changed) throw invalidResetToken();
}
