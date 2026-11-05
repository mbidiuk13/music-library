/**
 * @module hooks/useRequest
 * @description Завантаження даних з API для сторінки: стан «завантаження», дані, помилка
 * і повторна спроба. Запит, що став неактуальним (зміна параметрів, перехід зі сторінки), скасовується.
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * Хук завантаження даних.
 * @template T
 * @param {((signal: AbortSignal) => Promise<T>)|null} load - функція запиту; нова функція (інші
 *   параметри) запускає новий запит, null — нічого не завантажувати. Має бути стабільною між
 *   рендерами (функція модуля, useCallback або useMemo).
 * @returns {{data: T|undefined, error: unknown, isLoading: boolean, reload: () => void}}
 *   результат поточного запиту і функція повторної спроби.
 */
export default function useRequest(load) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({
    load: /** @type {typeof load} */ (null),
    attempt: -1,
    data: /** @type {T|undefined} */ (undefined),
    error: /** @type {unknown} */ (null),
  });

  useEffect(() => {
    if (!load) return undefined;
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => setResult({ load, attempt, data, error: null }),
      (error) => {
        if (error?.name !== 'AbortError') setResult({ load, attempt, data: undefined, error });
      },
    );
    return () => controller.abort();
  }, [load, attempt]);

  /**
   * Повторює запит (кнопка «Спробувати ще раз»).
   * @returns {void}
   */
  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  // Результат належить саме поточному запиту — інакше дані ще завантажуються.
  const isCurrent = Boolean(load) && result.load === load && result.attempt === attempt;
  return {
    data: isCurrent ? result.data : undefined,
    error: isCurrent ? result.error : null,
    isLoading: Boolean(load) && !isCurrent,
    reload,
  };
}
