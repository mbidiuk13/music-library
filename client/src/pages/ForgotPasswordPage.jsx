/**
 * @module pages/ForgotPasswordPage
 * @description Запит на відновлення пароля (UC-10, маршрут `/forgot-password`). Після надсилання
 * завжди показується однакове повідомлення «Якщо обліковий запис існує, лист надіслано» —
 * за ним не можна дізнатися, чи зареєстрована пошта (захист від перебору адрес).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { forgotPassword } from '../api/auth.js';
import FormField from '../components/FormField.jsx';
import useForm from '../hooks/useForm.js';
import { errorMessage } from '../utils/errors.js';
import { validateEmail } from '../utils/validation.js';

/** Початкові значення полів форми. */
const INITIAL_VALUES = Object.freeze({ email: '' });

/**
 * Валідація форми — ті самі правила, що й у `POST /api/auth/forgot-password`.
 * @param {{email: string}} values - значення полів.
 * @returns {{email: string|null}} ключ i18n помилки.
 */
function validateForgot({ email }) {
  return { email: validateEmail(email) };
}

/**
 * Сторінка запиту на відновлення пароля.
 * @returns {JSX.Element} сторінка.
 */
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { values, isValid, handleChange, handleBlur, fieldError, setServerErrors, touchAll } =
    useForm(INITIAL_VALUES, validateForgot);
  const [formError, setFormError] = useState(/** @type {string|null} */ (null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  /**
   * Надсилає запит на лист із посиланням для відновлення.
   * @param {import('react').FormEvent<HTMLFormElement>} event - подія надсилання.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    touchAll();
    if (!isValid || isSubmitting) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      await forgotPassword(values.email.trim());
      setIsSent(true);
    } catch (err) {
      setServerErrors(err.details);
      setFormError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t('pages.forgotPassword.title')}</h1>
        <p className="auth-page__subtitle">{t('pages.forgotPassword.subtitle')}</p>
      </header>

      {isSent ? (
        <div className="notice notice--success" role="status">
          <strong>{t('pages.forgotPassword.sent')}</strong>
          <br />
          {t('pages.forgotPassword.sentHint')}
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <FormField
            name="email"
            type="email"
            label={t('fields.email')}
            placeholder={t('fields.emailPlaceholder')}
            autoComplete="email"
            value={values.email}
            onChange={handleChange}
            onBlur={handleBlur}
            error={fieldError('email')}
          />
          {formError && (
            <p className="notice notice--error" role="alert">
              {formError}
            </p>
          )}
          <button
            type="submit"
            className="btn-primary btn-primary--block"
            disabled={!isValid || isSubmitting}
          >
            {t(isSubmitting ? 'pages.forgotPassword.submitting' : 'pages.forgotPassword.submit')}
          </button>
        </form>
      )}

      <p className="auth-page__switch">
        <Link to="/welcome" className="link-accent">
          {t('pages.forgotPassword.backToLogin')}
        </Link>
      </p>
    </section>
  );
}
