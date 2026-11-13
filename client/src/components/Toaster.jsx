//контейнер popover, він у верхньому шарі (top layer), тож видимий і поверх модального вікна

import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';

//без Popover API контейнер лишається звичайним фіксованим блоком
function supportsPopover(element) {
  return typeof element?.showPopover === 'function';
}

export default function Toaster({ toasts, onDismiss }) {
  const { t } = useTranslation();
  const containerRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const lastIdRef = useRef(0);

  /*нове сповіщення: контейнер заново показується у верхньому шарі — над усіма відкритими
  модальними вікнами, порожній контейнер ховається*/
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!supportsPopover(container)) return;
    const lastId = toasts.at(-1)?.id ?? 0;
    const isOpen = container.matches(':popover-open');
    if (toasts.length === 0) {
      if (isOpen) container.hidePopover();
    } else if (!isOpen || lastId !== lastIdRef.current) {
      if (isOpen) container.hidePopover();
      container.showPopover();
    }
    lastIdRef.current = lastId;
  }, [toasts]);

  return (
    <div
      ref={containerRef}
      className="toaster"
      popover="manual"
      role="region"
      aria-label={t('toast.label')}
    >
      <ul className="toaster__list" aria-live="polite">
        {toasts.map((toast) => (
          <li
            key={toast.id}
            className={`toast toast--${toast.type}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            <Icon
              name={toast.type === 'error' ? 'alert' : 'check'}
              size={20}
              className="toast__icon"
            />
            <span className="toast__message">{toast.message}</span>
            <button
              type="button"
              className="icon-button toast__close"
              onClick={() => onDismiss(toast.id)}
              aria-label={t('toast.close')}
              title={t('toast.close')}
            >
              <Icon name="close" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
