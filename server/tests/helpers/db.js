/**
 * @file Допоміжні функції інтеграційних тестів, що працюють з тестовою БД.
 */

import { randomUUID } from 'node:crypto';

/**
 * `describe` для тестів, яким потрібна БД: без TEST_DATABASE_URL групу буде пропущено.
 * @type {jest.Describe}
 */
export const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * Генерує унікальну адресу електронної пошти, щоб тестові файли могли працювати
 * з однією БД паралельно, не заважаючи один одному.
 * @param {string} [prefix='user'] - початок локальної частини адреси.
 * @returns {string} адреса виду `prefix-<uuid>@test.local`.
 */
export function uniqueEmail(prefix = 'user') {
  return `${prefix}-${randomUUID()}@test.local`;
}
