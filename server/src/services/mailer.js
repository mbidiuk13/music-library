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
 * Надсилає текстовий лист або, без SMTP, виводить його в консоль.
 * @param {{to: string, subject: string, text: string}} message - адресат, тема, текст.
 * @returns {Promise<void>}
 * @throws {Error} якщо SMTP-сервер відхилив лист.
 */
async function sendMail({ to, subject, text }) {
  const smtp = getTransporter();
  if (!smtp) {
    if (!config.isTest) {
      console.log(`\n[Лист без SMTP] Кому: ${to}\nТема: ${subject}\n\n${text}\n`);
    }
    return;
  }
  await smtp.sendMail({ from: config.smtp.from, to, subject, text });
}

/**
 * Надсилає лист із посиланням для відновлення пароля.
 * @param {{to: string, username: string, link: string}} data - адресат, ім'я, посилання.
 * @returns {Promise<void>}
 * @throws {Error} якщо лист не вдалося надіслати.
 */
async function sendPasswordResetEmail({ to, username, link }) {
  await sendMail({
    to,
    subject: 'MusicLibrary: відновлення пароля',
    text: [
      `Вітаємо, ${username}!`,
      '',
      'Ви надіслали запит на відновлення пароля в MusicLibrary.',
      'Щоб встановити новий пароль, перейдіть за посиланням (діє 15 хвилин):',
      link,
      '',
      'Якщо ви не надсилали запит, проігноруйте цей лист — пароль залишиться без змін.',
    ].join('\n'),
  });
}

/** Поштовий сервіс (об'єкт, щоб у тестах можна було підмінити надсилання). */
const mailer = { sendPasswordResetEmail };

export default mailer;
