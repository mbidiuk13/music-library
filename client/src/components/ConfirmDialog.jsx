import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../utils/errors.js';
import Modal from './Modal.jsx';

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

  //після успіху вікно закриває батьківський компонент (в onConfirm)
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
