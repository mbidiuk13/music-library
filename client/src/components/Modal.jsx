/**
 * @module components/Modal
 * @description Власне модальне вікно (розділ 9 SPEC «Стани UI»: підтвердження й форми — не
 * `window.confirm`). Побудоване на нативному елементі `<dialog>`: браузер сам утримує фокус
 * усередині, робить решту сторінки неактивною і закриває вікно клавішею Esc.
 * Вікно відкрите, поки компонент змонтований; закриває його батьківський компонент.
 */

import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';

/**
 * Модальне вікно.
 * @param {object} props - властивості.
 * @param {string} props.title - заголовок вікна.
 * @param {() => void} props.onClose - закриття (хрестик, Esc, клік поза вікном).
 * @param {boolean} [props.isBusy=false] - виконується запит: закрити вікно не можна, щоб не втратити результат.
 * @param {'sm'|'md'|'lg'} [props.size='sm'] - ширина вікна.
 * @param {import('react').ReactNode} props.children - вміст вікна.
 * @returns {JSX.Element} елемент `<dialog>`.
 */
export default function Modal({ title, onClose, isBusy = false, size = 'sm', children }) {
  const { t } = useTranslation();
  const dialogRef = useRef(/** @type {HTMLDialogElement|null} */ (null));
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();

  // Відкриття в модальному режимі під час монтування, закриття — під час демонтування.
  // showModal() ставить фокус на першу кнопку (хрестик), тому поле з `data-autofocus`
  // (напр. назва плейлиста) отримує фокус окремо — можна одразу вводити текст.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[data-autofocus]')?.focus();
    return () => dialog.close();
  }, []);

  /**
   * Клавіша Esc: браузер закрив би вікно сам — замість цього рішення приймає батьківський компонент.
   * @param {import('react').SyntheticEvent<HTMLDialogElement>} event - подія `cancel`.
   * @returns {void}
   */
  const handleCancel = (event) => {
    event.preventDefault();
    if (!isBusy) onClose();
  };

  /**
   * Клік по затемненню навколо вікна (ціль події — сам `<dialog>`, а не його вміст).
   * Закриває вікно, лише якщо і натискання, і відпускання кнопки миші були поза вмістом.
   * @param {import('react').MouseEvent<HTMLDialogElement>} event - подія кліку.
   * @returns {void}
   */
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
