/*дублює серверні правила, щоб помилку було видно ще до надсилання; сервер перевіряє повторно.
Валідатори повертають ключ i18n помилки або null; межі для повідомлень — у LIMITS*/

export const LIMITS = Object.freeze({
  passwordMin: 10,
  passwordMax: 64,
  emailMax: 255,
  usernameMax: 100,
  queryMax: 100,
  playlistTitleMax: 100,
  trackTextMax: 255,
  bpmMin: 40,
  bpmMax: 250,
  yearMin: 1,
  yearMax: new Date().getFullYear() + 1,
  uploadMaxMb: 50,
});

export const AUDIO_EXTENSIONS = Object.freeze(['.mp3', '.wav']);
const BYTES_IN_MB = 1024 * 1024;
const INTEGER_FORMAT = /^-?\d+$/;

//друковані ASCII-символи без пробілу (коди 0x21–0x7E)
const PASSWORD_ALLOWED = /^[\x21-\x7E]*$/;
const HAS_LETTER = /[A-Za-z]/;
const HAS_DIGIT = /[0-9]/;
const HAS_SPECIAL = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

/*після «@» шукається перша крапка, перед якою є символ: перевірка за лінійний час
(без катастрофічного перебору варіантів розбиття домену)*/
const EMAIL_FORMAT = /^[^\s@]+@[^\s@][^\s@.]*\.[^\s@]+$/;

export function validateEmail(email) {
  const value = email.trim();
  if (!value) return 'validation.email.required';
  if (value.length > LIMITS.emailMax) return 'validation.email.tooLong';
  if (!EMAIL_FORMAT.test(value)) return 'validation.email.invalid';
  return null;
}

export function validateUsername(username) {
  const value = username.trim();
  if (!value) return 'validation.username.required';
  if (value.length > LIMITS.usernameMax) return 'validation.username.tooLong';
  return null;
}

export function validateRequired(value, key) {
  return value.trim() ? null : key;
}

export function passwordRequirements(password) {
  return [
    {
      key: 'validation.password.ruleLength',
      isMet: password.length >= LIMITS.passwordMin && password.length <= LIMITS.passwordMax,
    },
    { key: 'validation.password.ruleLetter', isMet: HAS_LETTER.test(password) },
    { key: 'validation.password.ruleDigit', isMet: HAS_DIGIT.test(password) },
    { key: 'validation.password.ruleSpecial', isMet: HAS_SPECIAL.test(password) },
  ];
}

//правила FR-2 у тому самому порядку, що й на сервері
export function validateNewPassword(password) {
  if (!password) return 'validation.password.required';
  if (!PASSWORD_ALLOWED.test(password)) return 'validation.password.charset';
  if (password.length < LIMITS.passwordMin || password.length > LIMITS.passwordMax) {
    return 'validation.password.length';
  }
  if (!HAS_LETTER.test(password)) return 'validation.password.letter';
  if (!HAS_DIGIT.test(password)) return 'validation.password.digit';
  if (!HAS_SPECIAL.test(password)) return 'validation.password.special';
  return null;
}

export function validatePasswordConfirm(password, passwordConfirm) {
  if (!passwordConfirm) return 'validation.passwordConfirm.required';
  if (password !== passwordConfirm) return 'validation.passwordConfirm.mismatch';
  return null;
}

export function validateSearchQuery(query) {
  const value = query.trim();
  if (!value) return 'validation.search.required';
  if (value.length > LIMITS.queryMax) return 'validation.search.tooLong';
  return null;
}

export function validatePlaylistTitle(title) {
  const value = title.trim();
  if (!value) return 'validation.playlistTitle.required';
  if (value.length > LIMITS.playlistTitleMax) return 'validation.playlistTitle.tooLong';
  return null;
}

export function validateTrackText(value, field) {
  const text = value.trim();
  if (!text) return `validation.track.${field}Required`;
  if (text.length > LIMITS.trackTextMax) return `validation.track.${field}TooLong`;
  return null;
}

export function validateChoice(value, options, field) {
  return options.includes(value) ? null : `validation.track.${field}Required`;
}

export function validateIntegerRange(value, min, max, field) {
  const text = value.trim();
  if (!INTEGER_FORMAT.test(text)) return `validation.track.${field}Range`;
  const number = Number(text);
  return number >= min && number <= max ? null : `validation.track.${field}Range`;
}

export function validateAudioFile(file) {
  if (!file) return 'validation.track.fileRequired';
  const name = file.name.toLowerCase();
  if (!AUDIO_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return 'validation.track.fileFormat';
  }
  if (file.size > LIMITS.uploadMaxMb * BYTES_IN_MB) return 'validation.track.fileTooLarge';
  if (file.size === 0) return 'validation.track.fileEmpty';
  return null;
}
