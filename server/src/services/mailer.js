/**
 * @module services/mailer
 * @description Надсилання електронних листів через nodemailer (SMTP з .env).
 * Якщо SMTP_HOST не задано (режим розробки), лист не надсилається, а його текст
 * виводиться в консоль сервера — так посилання для відновлення пароля можна відкрити вручну.
 */

import nodemailer from 'nodemailer';
import config from '../config/index.js';

/** Стандартний порт SMTP із шифруванням TLS від початку з'єднання. */
const SMTPS_PORT = 465;

/** @type {import('nodemailer').Transporter|undefined} */
let transporter;

/**
 * Повертає (і за потреби створює) SMTP-транспорт.
 * @returns {import('nodemailer').Transporter|null} транспорт або null, якщо SMTP не налаштовано.
 */
function getTransporter() {
  if (!config.smtp.host) return null;
  transporter ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === SMTPS_PORT,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transporter;
}

/**
 * Надсилає лист (текстова й HTML-версії) або, без SMTP, виводить у консоль лише текстову.
 * @param {{to: string, subject: string, text: string, html?: string}} message - адресат,
 *   тема, текст і необов'язкова HTML-версія листа.
 * @returns {Promise<void>}
 * @throws {Error} якщо SMTP-сервер відхилив лист.
 */
async function sendMail({ to, subject, text, html }) {
  const smtp = getTransporter();
  if (!smtp) {
    if (!config.isTest) {
      console.log(`\n[Лист без SMTP] Кому: ${to}\nТема: ${subject}\n\n${text}\n`);
    }
    return;
  }
  await smtp.sendMail({ from: config.smtp.from, to, subject, text, html });
}

/** Символи, які треба екранувати в HTML (і в тексті, і в значеннях атрибутів). */
const HTML_ESCAPES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

/**
 * Екранує спецсимволи HTML (`& < > " '`), щоб введені користувачем дані
 * (ім'я) не могли змінити розмітку листа.
 * @param {string} value - довільний рядок.
 * @returns {string} рядок, безпечний для вставлення в HTML-текст або атрибут.
 */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Тема листа для відновлення пароля. */
const RESET_SUBJECT = 'MusicLibrary: відновлення пароля';

/** Системні шрифти листа (зовнішні шрифти в листах не підключаються). */
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";

/**
 * Формує лист із посиланням для відновлення пароля: тему, текстову версію і
 * самодостатню HTML-версію (таблична верстка, лише вбудовані стилі, без зовнішніх
 * ресурсів і скриптів) у кольорах інтерфейсу застосунку.
 * Чиста функція — не надсилає лист і не звертається до конфігурації.
 * @param {{username: string, link: string}} data - ім'я користувача і посилання для відновлення.
 * @returns {{subject: string, text: string, html: string}} тема, текст і HTML листа.
 */
export function buildPasswordResetEmail({ username, link }) {
  const text = [
    `Вітаємо, ${username}!`,
    '',
    'Ви надіслали запит на відновлення пароля в MusicLibrary.',
    'Щоб встановити новий пароль, перейдіть за посиланням (діє 15 хвилин):',
    link,
    '',
    'Якщо ви не надсилали запит, проігноруйте цей лист — пароль залишиться без змін.',
  ].join('\n');

  const name = escapeHtml(username);
  const href = escapeHtml(link);

  const html = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Відновлення пароля</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0814;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">Посилання для встановлення нового пароля діє 15 хвилин.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0814;">
<tr>
<td align="center" style="padding:40px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background-color:#171327;border:1px solid #2a2342;border-radius:16px;">
<tr>
<td style="padding:40px 32px;font-family:${FONT_STACK};color:#a7a1c0;font-size:15px;line-height:1.6;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr>
<td align="center" valign="middle" width="56" height="56" style="width:56px;height:56px;border-radius:14px;background-color:#ff7a59;background-image:linear-gradient(135deg, #ff7a59, #c04cfd);color:#ffffff;font-size:28px;line-height:56px;text-align:center;">&#9834;</td>
</tr>
</table>
<h1 style="margin:24px 0 8px;font-size:24px;line-height:1.3;font-weight:700;color:#ffffff;text-align:center;">Відновлення пароля</h1>
<p style="margin:24px 0 0;color:#ffffff;font-weight:600;">Вітаємо, ${name}!</p>
<p style="margin:12px 0 0;">Ви надіслали запит на відновлення пароля в MusicLibrary. Щоб встановити новий пароль, натисніть кнопку нижче.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto;">
<tr>
<td align="center" bgcolor="#ff7a59" style="border-radius:10px;background-color:#ff7a59;">
<a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#ff7a59;">Встановити новий пароль</a>
</td>
</tr>
</table>
<p style="margin:0;text-align:center;">Посилання діє 15 хвилин.</p>
<p style="margin:28px 0 0;font-size:13px;">Якщо кнопка не працює, скопіюйте посилання:</p>
<p style="margin:4px 0 0;font-size:13px;word-break:break-all;"><a href="${href}" target="_blank" style="color:#ff7a59;text-decoration:underline;">${href}</a></p>
<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #2a2342;font-size:13px;">Якщо ви не надсилали запит, проігноруйте цей лист — пароль залишиться без змін.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
`;

  return { subject: RESET_SUBJECT, text, html };
}

/**
 * Надсилає лист із посиланням для відновлення пароля.
 * @param {{to: string, username: string, link: string}} data - адресат, ім'я, посилання.
 * @returns {Promise<void>}
 * @throws {Error} якщо лист не вдалося надіслати.
 */
async function sendPasswordResetEmail({ to, username, link }) {
  await sendMail({ to, ...buildPasswordResetEmail({ username, link }) });
}

/** Поштовий сервіс (об'єкт, щоб у тестах можна було підмінити надсилання). */
const mailer = { sendPasswordResetEmail };

export default mailer;
