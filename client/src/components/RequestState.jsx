import { useTranslation } from 'react-i18next';
import { errorMessage } from '../utils/errors.js';
import Icon from './Icon.jsx';

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

export function EmptyState({ title, text, children }) {
  return (
    <div className="state-message" role="status">
      <p className="state-message__title">{title}</p>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
