/**
 * @module components/RequestState
 * @description Стани запиту для списків (розділ 9 SPEC «Стани UI»): скелетон під час завантаження,
 * повідомлення про помилку з кнопкою повтору, порожній результат.
 */

import { useTranslation } from 'react-i18next';
import { errorMessage } from '../utils/errors.js';

/**
 * Скелетон списку треків під час завантаження.
 * @param {{rows?: number}} props - кількість рядків-заглушок.
 * @returns {JSX.Element} заглушка.
 */
export function TrackListSkeleton({ rows = 6 }) {
  const { t } = useTranslation();
  return (
    <div className="skeleton-list" role="status" aria-label={t('common.loading')}>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="skeleton-list__row" />
      ))}
    </div>
  );
}

/**
 * Повідомлення про помилку запиту з кнопкою «Спробувати ще раз».
 * @param {{error: unknown, onRetry: () => void}} props - помилка і дія повтору.
 * @returns {JSX.Element} блок помилки.
 */
export function RequestError({ error, onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="state-message state-message--error" role="alert">
      <p>{errorMessage(error)}</p>
      <button type="button" className="btn-secondary" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </div>
  );
}

/**
 * Порожній результат.
 * @param {{title: string, text?: string}} props - заголовок і пояснення.
 * @returns {JSX.Element} блок повідомлення.
 */
export function EmptyState({ title, text }) {
  return (
    <div className="state-message" role="status">
      <p className="state-message__title">{title}</p>
      {text && <p>{text}</p>}
    </div>
  );
}
