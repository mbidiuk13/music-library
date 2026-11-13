import * as authService from './auth.service.js';

export async function register(req, res) {
  const { email, username, password } = req.body;
  const result = await authService.register({ email, username, password });
  res.status(201).json(result);
}

export async function login(req, res) {
  const { email, password } = req.body;
  res.json(await authService.login({ email, password }));
}

export async function me(req, res) {
  res.json({ user: await authService.getCurrentUser(req.user.id) });
}

//відповідь однакова незалежно від того, чи зареєстровано email
export async function forgotPassword(req, res) {
  await authService.requestPasswordReset(req.body.email);
  res.json({
    message:
      'Якщо обліковий запис з такою поштою існує, ми надіслали на неї посилання для відновлення пароля',
  });
}

export async function verifyResetToken(req, res) {
  await authService.verifyResetToken(req.body.token);
  res.status(204).end();
}

export async function resetPassword(req, res) {
  const { token, password } = req.body;
  await authService.resetPassword({ token, password });
  res.json({ message: 'Пароль змінено. Увійдіть з новим паролем' });
}
