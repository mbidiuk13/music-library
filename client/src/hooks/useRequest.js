import { useCallback, useEffect, useState } from 'react';

//load має бути стабільною: нова функція — новий запит (попередній скасовується), null — без запиту
export default function useRequest(load) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({
    load: /** @type {typeof load} */ (null),
    attempt: -1,
    data: /** @type {unknown} */ (undefined),
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

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  //результат належить саме поточному запиту — інакше дані ще завантажуються
  const isCurrent = Boolean(load) && result.load === load && result.attempt === attempt;
  return {
    data: isCurrent ? result.data : undefined,
    error: isCurrent ? result.error : null,
    isLoading: Boolean(load) && !isCurrent,
    reload,
  };
}
