/**
 * @module components/RequestState
 * @description Єдині для всіх сторінок стани запиту (розділ 9 SPEC «Стани UI»): скелетон списку
 * або спінер під час завантаження, повідомлення про помилку з кнопкою «Спробувати ще раз»
 * (зокрема для помилки мережі) і порожній результат.
 */

import { useTranslation } from 'react-i18next';
import { errorMessage } from '../utils/errors.js';
import Icon from './Icon.jsx';

/**
 * Скелетон списку треків (карток, плейлистів) під час завантаження.
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
 * Спінер з підписом «Завантаження…» — для станів, де немає списку (напр. відновлення сесії).
 * @param {{fullScreen?: boolean}} props - чи займати весь екран.
 * @returns {JSX.Element} індикатор завантаження.
 */
export function LoadingState({ fullScreen = false }) {
  const { t } = useTranslation();
  return (
    <div
      className={fullScreen ? 'loading-state loading-state--screen' : 'loading-state'}
      role="status"
    >
      <span className="loading-state__spinner" aria-hidden="true" />
      <span>{t('common.loading')}</span>
    </div>
  );
}

/**
 * Повідомлення про помилку запиту з кнопкою «Спробувати ще раз». Текст пояснює причину:
 * для помилки мережі — «Немає зв'язку із сервером…», для відомих кодів — власне повідомлення.
 * @param {{error: unknown, onRetry: () => void}} props - помилка і дія повтору.
 * @returns {JSX.Element} блок помилки.
 */
export function RequestError({ error, onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="state-message state-message--error" role="alert">
      <p className="state-message__title">
        <Icon name="alert" size={20} />
        {t('errors.requestTitle')}
      </p>
      <p>{errorMessage(error)}</p>
      <button type="button" className="btn-secondary" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </div>
  );
}

/**
 * Порожній результат («Нічого не знайдено», порожній плейлист тощо).
 * @param {{title: string, text?: string, children?: import('react').ReactNode}} props -
 *   заголовок, пояснення і, за потреби, дія (напр. посилання «До плейлистів»).
 * @returns {JSX.Element} блок повідомлення.
 */
export function EmptyState({ title, text, children }) {
  return (
    <div className="state-message" role="status">
      <p className="state-message__title">{title}</p>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
