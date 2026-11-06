/**
 * @module components/PlaylistTitleDialog
 * @description Форма назви плейлиста у модальному вікні: створення нового плейлиста (UC-4)
 * і перейменування наявного (UC-11). Назва перевіряється ще на клієнті (1–100 символів);
 * зайняту назву (409) сервер повертає — вона показується під полем.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useForm from '../hooks/useForm.js';
import { errorMessage } from '../utils/errors.js';
import { LIMITS, validatePlaylistTitle } from '../utils/validation.js';
import FormField from './FormField.jsx';
import Modal from './Modal.jsx';

/**
 * Валідація форми назви плейлиста.
 * @param {{title: string}} values - значення поля.
 * @returns {{title: string|null}} ключ i18n помилки.
 */
function validateTitleForm(values) {
  return { title: validatePlaylistTitle(values.title) };
}

/**
 * Вікно з формою назви плейлиста.
 * @param {object} props - властивості.
 * @param {string} props.title - заголовок вікна.
 * @param {string} props.submitLabel - текст кнопки збереження.
 * @param {string} props.busyLabel - текст кнопки під час запиту.
 * @param {string} [props.initialTitle=''] - поточна назва (для перейменування).
 * @param {(title: string) => Promise<void>} props.onSubmit - збереження; помилка API лишає вікно відкритим.
 * @param {() => void} props.onClose - закриття без змін.
 * @returns {JSX.Element} модальне вікно з формою.
 */
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

  /**
   * Надсилає форму. Зайнята назва показується під полем, інші помилки — над кнопками.
   * @param {import('react').FormEvent<HTMLFormElement>} event - подія надсилання.
   * @returns {Promise<void>}
   */
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
