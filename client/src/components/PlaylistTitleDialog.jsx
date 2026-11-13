import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useForm from '../hooks/useForm.js';
import { errorMessage } from '../utils/errors.js';
import { LIMITS, validatePlaylistTitle } from '../utils/validation.js';
import FormField from './FormField.jsx';
import Modal from './Modal.jsx';

function validateTitleForm(values) {
  return { title: validatePlaylistTitle(values.title) };
}

export default function PlaylistTitleDialog({
  title,
  submitLabel,
  busyLabel,
  initialTitle = '',
  onSubmit,
  onClose,
}) {
  const { t } = useTranslation();
  const [initialValues] = useState(() => ({ title: initialTitle }));
  const { values, isValid, handleChange, handleBlur, fieldError, setServerErrors, touchAll } =
    useForm(initialValues, validateTitleForm);
  const [isBusy, setIsBusy] = useState(false);
  const [formError, setFormError] = useState(/** @type {string|null} */ (null));

  const handleSubmit = async (event) => {
    event.preventDefault();
    touchAll();
    if (!isValid || isBusy) return;
    setIsBusy(true);
    setFormError(null);
    try {
      await onSubmit(values.title.trim());
    } catch (err) {
      if (err.code === 'PLAYLIST_TITLE_TAKEN') {
        setServerErrors([{ field: 'title', message: errorMessage(err) }]);
      } else {
        setServerErrors(err.details);
        setFormError(errorMessage(err));
      }
      setIsBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} isBusy={isBusy}>
      <form className="modal__form" onSubmit={handleSubmit} noValidate>
        <FormField
          name="title"
          label={t('playlists.titleLabel')}
          placeholder={t('playlists.titlePlaceholder')}
          maxLength={LIMITS.playlistTitleMax}
          autoComplete="off"
          data-autofocus
          value={values.title}
          onChange={handleChange}
          onBlur={handleBlur}
          error={fieldError('title')}
        />
        {formError && (
          <p className="notice notice--error" role="alert">
            {formError}
          </p>
        )}
        <div className="modal__actions">
          <button type="button" className="btn-outline" onClick={onClose} disabled={isBusy}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={!isValid || isBusy}>
            {isBusy ? busyLabel : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
