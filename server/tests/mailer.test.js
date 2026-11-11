/**
 * @file Unit-тести формування листа для відновлення пароля (UC-10): текстова версія
 * не змінилася, HTML-версія містить посилання, екранує ім'я і не має зовнішніх ресурсів.
 */

import { buildPasswordResetEmail } from '../src/services/mailer.js';

/** Тестове посилання для відновлення пароля. */
const LINK = 'http://localhost:5173/reset-password?token=abc123';

describe('buildPasswordResetEmail()', () => {
  test('повертає тему і незмінну текстову версію', () => {
    const { subject, text } = buildPasswordResetEmail({ username: 'Марія', link: LINK });

    expect(subject).toBe('MusicLibrary: відновлення пароля');
    expect(text).toBe(
      [
        'Вітаємо, Марія!',
        '',
        'Ви надіслали запит на відновлення пароля в MusicLibrary.',
        'Щоб встановити новий пароль, перейдіть за посиланням (діє 15 хвилин):',
        LINK,
        '',
        'Якщо ви не надсилали запит, проігноруйте цей лист — пароль залишиться без змін.',
      ].join('\n'),
    );
  });

  test('HTML містить посилання в кнопці і як видимий текст', () => {
    const { html } = buildPasswordResetEmail({ username: 'Марія', link: LINK });

    expect(html).toMatch(
      new RegExp(`<a href="${escapeRegExp(LINK)}"[^>]*>Встановити новий пароль</a>`),
    );
    expect(html).toContain(`>${LINK}</a>`);
    expect(html).toContain('Посилання діє 15 хвилин.');
    expect(html).toContain('lang="uk"');
  });

  test("HTML екранує ім'я користувача", () => {
    const { html, text } = buildPasswordResetEmail({
      username: '<b>"Tom" & \'Jerry\'</b>',
      link: LINK,
    });

    expect(html).toContain('Вітаємо, &lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;!');
    expect(html).not.toContain('<b>');
    expect(text).toContain('Вітаємо, <b>"Tom" & \'Jerry\'</b>!');
  });

  test('HTML екранує спецсимволи в посиланні', () => {
    const { html } = buildPasswordResetEmail({ username: 'Марія', link: `${LINK}&x="1"` });

    expect(html).toContain(`href="${LINK}&amp;x=&quot;1&quot;"`);
    expect(html).not.toContain('x="1"');
  });

  test('HTML без скриптів і зовнішніх ресурсів, крім посилання для відновлення', () => {
    const { html } = buildPasswordResetEmail({ username: 'Марія', link: LINK });

    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link|<img|<style|\ssrc=|url\(/i);
    const urls = html.match(/https?:\/\/[^\s"'<>]+/g);
    expect(urls.length).toBeGreaterThan(0);
    expect(new Set(urls)).toEqual(new Set([LINK]));
  });
});

/**
 * Екранує спецсимволи регулярного виразу.
 * @param {string} value - рядок.
 * @returns {string} рядок для вставлення в RegExp.
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
