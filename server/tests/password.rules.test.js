/**
 * @file Unit-тести правил надійності пароля (FR-2, тест 1.1 розділу 4 ПЗ).
 */

import {
  checkPassword,
  isCommonPassword,
  PASSWORD_MESSAGES,
} from '../src/modules/auth/password.rules.js';

describe('checkPassword()', () => {
  test.each(['Str0ng!Pass', 'abcdefgh1!', 'A1~' + 'x'.repeat(61), 'Zx9$Zx9$Zx9$'])(
    'приймає надійний пароль %s',
    (password) => {
      expect(checkPassword(password)).toBeNull();
    },
  );

  test.each([
    [undefined, PASSWORD_MESSAGES.required],
    ['', PASSWORD_MESSAGES.required],
    [12345678901, PASSWORD_MESSAGES.required],
    ['Пароль123!!', PASSWORD_MESSAGES.charset],
    ['Str0ng Pass!', PASSWORD_MESSAGES.charset],
    ['Str0ng!Пас', PASSWORD_MESSAGES.charset],
    ['Sh0rt!pas', PASSWORD_MESSAGES.length],
    ['A1~' + 'x'.repeat(62), PASSWORD_MESSAGES.length],
    ['1234567890!', PASSWORD_MESSAGES.letter],
    ['abcdefghij!', PASSWORD_MESSAGES.digit],
    ['abcdefghij1', PASSWORD_MESSAGES.special],
  ])('відхиляє %p: %s', (password, message) => {
    expect(checkPassword(password)).toBe(message);
  });

  test('межі довжини: 10 і 64 символи допустимі', () => {
    expect(checkPassword('Abcdefg1!x')).toBeNull();
    expect(checkPassword('A1!' + 'b'.repeat(61))).toBeNull();
  });
});

describe('isCommonPassword()', () => {
  test('знаходить пароль зі списку без урахування регістру', () => {
    expect(isCommonPassword('password')).toBe(true);
    expect(isCommonPassword('QWERTY')).toBe(true);
    expect(isCommonPassword('PassWord1')).toBe(true);
  });

  test('не знаходить рідкісний пароль і не плутає коментарі зі списком', () => {
    expect(isCommonPassword('Str0ng!Pass')).toBe(false);
    expect(isCommonPassword('# Рядки, що починаються з #, — коментарі.')).toBe(false);
  });
});
