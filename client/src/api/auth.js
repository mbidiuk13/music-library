import { request } from './client.js';

export function login(credentials) {
  return request('/auth/login', { method: 'POST', body: credentials });
}

export function register(data) {
  return request('/auth/register', { method: 'POST', body: data });
}

export function fetchMe(signal) {
  return request('/auth/me', { signal });
}

export function forgotPassword(email) {
  return request('/auth/forgot-password', { method: 'POST', body: { email } });
}

export function verifyResetToken(token, signal) {
  return request('/auth/reset-password/verify', { method: 'POST', body: { token }, signal });
}

export function resetPassword(data) {
  return request('/auth/reset-password', { method: 'POST', body: data });
}
