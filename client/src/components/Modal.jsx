//нативний <dialog>: браузер сам утримує фокус усередині, блокує решту сторінки й обробляє Esc

import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';

export default function Modal({ title, onClose, isBusy = false, size = 'sm', children }) {
  const { t } = useTranslation();
  const dialogRef = useRef(/** @type {HTMLDialogElement|null} */ (null));
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();

  /*showModal() ставить фокус на першу кнопку (хрестик), тому поле з `data-autofocus`
  фокусується окремо, щоб можна було одразу вводити текст*/
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[data-autofocus]')?.focus();
    return () => dialog.close();
  }, []);

  //Esc: браузер закрив би вікно сам, натомість рішення приймає батьківський компонент
  const handleCancel = (event) => {
    event.preventDefault();
    if (!isBusy) onClose();
  };

  //закриває, лише якщо і натискання, і відпускання миші були на затемненні (ціль сам <dialog>)
  const handleClick = (event) => {
    const isBackdrop = event.target === dialogRef.current;
    if (isBackdrop && pressedOnBackdrop.current && !isBusy) onClose();
    pressedOnBackdrop.current = false;
  };

  return (
    <dialog
      ref={dialogRef}
      className={`modal modal--${size}`}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onMouseDown={(event) => {
        pressedOnBackdrop.current = event.target === dialogRef.current;
      }}
      onClick={handleClick}
    >
      <div className="modal__body">
        <header className="modal__header">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={isBusy}
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
