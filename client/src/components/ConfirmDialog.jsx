/**
 * @module components/ConfirmDialog
 * @description Підтвердження незворотної дії (видалення плейлиста, видалення треку адміністратором).
 * Поки виконується запит, кнопки неактивні; помилку сервера показує у вікні зрозумілим текстом.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../utils/errors.js';
import Modal from './Modal.jsx';

/**
 * Вікно підтвердження.
 * @param {object} props - властивості.
 * @param {string} props.title - заголовок (питання).
 * @param {string} props.text - пояснення наслідків дії.
 * @param {string} props.confirmLabel - текст кнопки підтвердження.
 * @param {string} props.busyLabel - текст кнопки під час виконання запиту.
 * @param {() => Promise<void>} props.onConfirm - дія; якщо вона кидає помилку, вікно лишається відкритим.
 * @param {() => void} props.onClose - закриття без дії.
 * @returns {JSX.Element} модальне вікно.
 */
export default function ConfirmDialog({
  title,
  text,
  confirmLabel,
  busyLabel,
  onConfirm,
  onClose,
}) {
  const { t } = useTranslation();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(/** @type {unknown} */ (null));

  /**
   * Виконує дію. Після успіху вікно закриває батьківський компонент (у onConfirm).
   * @returns {Promise<void>}
   */
  const handleConfirm = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err);
      setIsBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} isBusy={isBusy}>
      <p className="modal__text">{text}</p>
      {error && (
        <p className="notice notice--error" role="alert">
          {errorMessage(error)}
        </p>
      )}
      <div className="modal__actions">
        <button type="button" className="btn-outline" onClick={onClose} disabled={isBusy}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn-danger" onClick={handleConfirm} disabled={isBusy}>
          {isBusy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
