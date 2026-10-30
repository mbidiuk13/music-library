/**
 * @file Unit-тести middleware автентифікації (authenticate, optionalAuth) і RBAC (requireRole).
 * Використовується окремий мінімальний Express-застосунок, тому БД не потрібна.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { authenticate, optionalAuth } from '../src/middleware/auth.js';
import requireRole from '../src/middleware/requireRole.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { signAccessToken, verifyAccessToken } from '../src/utils/jwt.js';

const user = { id: '11111111-1111-4111-8111-111111111111', role: 'user', email: 'u@test.local' };
const admin = { id: '22222222-2222-4222-8222-222222222222', role: 'admin', email: 'a@test.local' };

const app = express();
app.get('/private', authenticate, (req, res) => res.json({ user: req.user }));
app.get('/public', optionalAuth, (req, res) => res.json({ user: req.user ?? null }));
app.get('/admin', authenticate, requireRole('admin'), (req, res) => res.json({ ok: true }));
app.use(errorHandler);

/**
 * Формує заголовок авторизації.
 * @param {string} token - JWT.
 * @returns {{Authorization: string}} заголовок для supertest.
 */
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe('utils/jwt', () => {
  test('токен доступу містить sub, role, email і строк дії', () => {
    const payload = verifyAccessToken(signAccessToken(user));
    expect(payload).toMatchObject({ sub: user.id, role: 'user', email: user.email });
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });
});

describe('authenticate', () => {
  test('дійсний токен → req.user', async () => {
    const res = await request(app)
      .get('/private')
      .set(bearer(signAccessToken(user)));
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(user);
  });

  test('без токена → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/private');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('заголовок не у форматі Bearer → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/private').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test.each([
    ['підписаний іншим ключем', jwt.sign({ sub: user.id, role: 'admin' }, 'інший ключ')],
    [
      'прострочений',
      jwt.sign({ sub: user.id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: -10 }),
    ],
    ['пошкоджений', 'not.a.jwt'],
    [
      'без підпису (alg none)',
      jwt.sign({ sub: user.id, role: 'admin' }, null, { algorithm: 'none' }),
    ],
  ])('токен %s → 401 INVALID_TOKEN', async (_, token) => {
    const res = await request(app).get('/private').set(bearer(token));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('optionalAuth', () => {
  test('без токена — гість', async () => {
    const res = await request(app).get('/public');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  test('з дійсним токеном — користувач', async () => {
    const res = await request(app)
      .get('/public')
      .set(bearer(signAccessToken(user)));
    expect(res.body.user).toEqual(user);
  });

  test('недійсний токен не блокує публічний ресурс', async () => {
    const res = await request(app).get('/public').set(bearer('not.a.jwt'));
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});

describe("requireRole('admin')", () => {
  test('адміністратор має доступ', async () => {
    const res = await request(app)
      .get('/admin')
      .set(bearer(signAccessToken(admin)));
    expect(res.status).toBe(200);
  });

  test('звичайний користувач → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/admin')
      .set(bearer(signAccessToken(user)));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('гість → 401', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(401);
  });
});
