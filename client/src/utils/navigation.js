//пошта для переходу між входом і відновленням пароля — через state маршрутизатора, не URL
export function emailState(email) {
  const trimmed = email.trim();
  return trimmed ? { email: trimmed } : undefined;
}
