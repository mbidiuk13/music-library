/**
 * @file Unit-тести хелпера transaction(): COMMIT при успіху, ROLLBACK при помилці.
 * З'єднання з БД підмінено фіктивним клієнтом, тому PostgreSQL для тестів не потрібен.
 */

import { jest } from '@jest/globals';
import { pool, transaction } from '../src/db/pool.js';

/**
 * Створює фіктивного клієнта пулу, який запам'ятовує виконані SQL-команди.
 * @param {(text: string) => Promise<unknown>} [onQuery] - реакція на запит (за замовчуванням — успіх).
 * @returns {{client: object, calls: string[]}} клієнт і журнал його запитів.
 */
function mockClient(onQuery = async () => ({ rows: [] })) {
  const calls = [];
  const client = {
    query: jest.fn(async (text) => {
      calls.push(text);
      return onQuery(text);
    }),
    release: jest.fn(),
  };
  jest.spyOn(pool, 'connect').mockResolvedValue(client);
  return { client, calls };
}

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => pool.end());

describe('transaction()', () => {
  test('успіх: BEGIN → запити → COMMIT, повертає результат fn', async () => {
    const { client, calls } = mockClient();

    const result = await transaction(async (tx) => {
      await tx.query('INSERT 1');
      await tx.query('INSERT 2');
      return 'готово';
    });

    expect(result).toBe('готово');
    expect(calls).toEqual(['BEGIN', 'INSERT 1', 'INSERT 2', 'COMMIT']);
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  test('помилка в fn: ROLLBACK і помилка передається далі', async () => {
    const { client, calls } = mockClient();

    await expect(
      transaction(async (tx) => {
        await tx.query('INSERT 1');
        throw new Error('збій на другому кроці');
      }),
    ).rejects.toThrow('збій на другому кроці');

    expect(calls).toEqual(['BEGIN', 'INSERT 1', 'ROLLBACK']);
    expect(calls).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  test("невдалий ROLLBACK: з'єднання повертається в пул як несправне", async () => {
    const rollbackError = new Error("з'єднання розірвано");
    const { client } = mockClient(async (text) => {
      if (text === 'ROLLBACK') throw rollbackError;
      return { rows: [] };
    });

    await expect(
      transaction(async () => {
        throw new Error('збій');
      }),
    ).rejects.toThrow('збій');

    expect(client.release).toHaveBeenCalledWith(rollbackError);
  });
});
