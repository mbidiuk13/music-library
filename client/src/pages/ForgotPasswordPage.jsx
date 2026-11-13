//відповідь завжди однакова, щоб не можна було дізнатися, чи зареєстрована пошта

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { forgotPassword } from '../api/auth.js';
import FormField from '../components/FormField.jsx';
import useForm from '../hooks/useForm.js';
import { errorMessage } from '../utils/errors.js';
import { emailState } from '../utils/navigation.js';
import { validateEmail } from '../utils/validation.js';

function validateForgot({ email }) {
  return { email: validateEmail(email) };
}

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { values, isValid, handleChange, handleBlur, fieldError, setServerErrors, touchAll } =
    useForm({ email: location.state?.email ?? '' }, validateForgot);
  const [formError, setFormError] = useState(/** @type {string|null} */ (null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

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
        <Link to="/welcome" state={emailState(values.email)} className="link-accent">
          {t('pages.forgotPassword.backToLogin')}
        </Link>
      </p>
    </section>
  );
}
