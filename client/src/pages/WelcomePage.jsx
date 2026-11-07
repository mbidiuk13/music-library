/**
 * @module pages/WelcomePage
 * @description Сторінка привітання з формою входу (рис. 4.1 ТЗ, UC-2, маршрут `/welcome`):
 * пошта, пароль, «Забули пароль?», «Створити акаунт», «Продовжити без входу».
 * Після успішного входу маршрут GuestOnly переводить користувача на головну
 * (або на сторінку, з якої його перенаправили на вхід).
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import FormField from '../components/FormField.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useForm from '../hooks/useForm.js';
import { errorMessage } from '../utils/errors.js';
import { validateRequired } from '../utils/validation.js';

/**
 * Валідація форми входу — ті самі правила, що й на сервері (`POST /api/auth/login`):
 * обидва поля обов'язкові. Вимоги до надійності пароля під час входу не перевіряються.
 * @param {{email: string, password: string}} values - значення полів.
 * @returns {{email: string|null, password: string|null}} ключі i18n помилок.
 */
function validateLogin({ email, password }) {
  return {
    email: validateRequired(email, 'validation.email.required'),
    password: password ? null : 'validation.password.required',
  };
}

/**
 * Сторінка привітання з формою входу.
 * @returns {JSX.Element} сторінка.
 */
export default function WelcomePage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const location = useLocation();

  const { values, isValid, handleChange, handleBlur, fieldError, setServerErrors, touchAll } =
    useForm({ email: location.state?.email ?? '', password: '' }, validateLogin);
  const [formError, setFormError] = useState(/** @type {string|null} */ (null));
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Надсилає форму входу. Помилку «Невірний логін або пароль» показує над кнопкою.
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
      await login({ email: values.email.trim(), password: values.password });
      // Перехід після входу виконує GuestOnly, коли сесія збережена.
    } catch (err) {
      setServerErrors(err.details);
      setFormError(errorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title auth-page__title--brand">{t('app.name')}</h1>
        <p className="auth-page__subtitle">{t('pages.welcome.tagline')}</p>
      </header>

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
        <FormField
          name="password"
          type="password"
          label={t('fields.password')}
          autoComplete="current-password"
          value={values.password}
          onChange={handleChange}
          onBlur={handleBlur}
          error={fieldError('password')}
          aside={
            <Link to="/forgot-password" className="link-accent">
              {t('pages.welcome.forgotPassword')}
            </Link>
          }
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
          {t(isSubmitting ? 'pages.welcome.submitting' : 'pages.welcome.submit')}
        </button>
      </form>

      <p className="auth-page__switch">
        {t('pages.welcome.newUser')}{' '}
        <Link to="/register" className="link-accent link-accent--underline">
          {t('pages.welcome.createAccount')}
        </Link>
      </p>

      <div className="divider">
        <span>{t('common.or')}</span>
      </div>

      <Link to="/" className="btn-outline btn-outline--block">
        {t('auth.continueAsGuest')}
        <Icon name="arrowRight" size={18} />
      </Link>
    </section>
  );
}
