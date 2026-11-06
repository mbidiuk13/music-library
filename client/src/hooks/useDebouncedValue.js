/**
 * @module hooks/useDebouncedValue
 * @description Значення із затримкою: оновлюється лише тоді, коли вихідне значення не змінювалося
 * заданий час. Використовується в пошуку адмін-панелі, щоб не надсилати запит на кожну літеру.
 */

import { useEffect, useState } from 'react';

/**
 * Хук значення із затримкою.
 * @template T
 * @param {T} value - вихідне значення (напр. текст у полі пошуку).
 * @param {number} [delay=300] - затримка в мілісекундах.
 * @returns {T} значення, яке не змінювалося щонайменше `delay` мс.
 */
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
