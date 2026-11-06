/**
 * @module pages/RegisterPage
 * @description Сторінка реєстрації (UC-1, маршрут `/register`): пошта, ім'я, пароль і повтор
 * пароля. Поки дані некоректні, кнопка неактивна, а поле з помилкою підсвічується
 * червоним. Після успішної реєстрації — повідомлення і перехід на сторінку входу.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import FormField from '../components/FormField.jsx';
import PasswordRules from '../components/PasswordRules.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useForm from '../hooks/useForm.js';
import { errorMessage } from '../utils/errors.js';
import {
  validateEmail,
  validateNewPassword,
  validatePasswordConfirm,
  validateUsername,
} from '../utils/validation.js';

/** Початкові значення полів форми. */
const INITIAL_VALUES = Object.freeze({
  email: '',
  username: '',
  password: '',
  passwordConfirm: '',
});

/**
 * Валідація форми реєстрації — ті самі правила, що й у `POST /api/auth/register`.
 * @param {typeof INITIAL_VALUES} values - значення полів.
 * @returns {Record<string, string|null>} ключі i18n помилок полів.
 */
function validateRegistration(values) {
  return {
    email: validateEmail(values.email),
    username: validateUsername(values.username),
    password: validateNewPassword(values.password),
    passwordConfirm: validatePasswordConfirm(values.password, values.passwordConfirm),
  };
}

/**
 * Сторінка реєстрації.
 * @returns {JSX.Element} сторінка.
 */
export default function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const { values, isValid, handleChange, handleBlur, fieldError, setServerErrors, touchAll } =
    useForm(INITIAL_VALUES, validateRegistration);
  const [formError, setFormError] = useState(/** @type {string|null} */ (null));
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Надсилає форму. Зайнятий email (409) показується під полем «Електронна пошта».
   * @param {import('react').FormEvent<HTMLFormElement>} event - подія надсилання.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    touchAll();
    if (!isValid || isSubmitting) return;
    setFormError(null);
    setIsSubmitting(true);
    const email = values.email.trim();
    try {
      await register({
        email,
        username: values.username.trim(),
        password: values.password,
        passwordConfirm: values.passwordConfirm,
      });
      navigate('/welcome', { replace: true, state: { notice: 'registered', email } });
    } catch (err) {
      if (err.code === 'EMAIL_TAKEN') {
        setServerErrors([{ field: 'email', message: errorMessage(err) }]);
      } else {
        setServerErrors(err.details);
        setFormError(errorMessage(err));
      }
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t('pages.register.title')}</h1>
        <p className="auth-page__subtitle">{t('pages.register.subtitle')}</p>
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
          name="username"
          label={t('fields.username')}
          placeholder={t('fields.usernamePlaceholder')}
          autoComplete="nickname"
          value={values.username}
          onChange={handleChange}
          onBlur={handleBlur}
          error={fieldError('username')}
        />
        <FormField
          name="password"
          type="password"
          label={t('fields.password')}
          autoComplete="new-password"
          value={values.password}
          onChange={handleChange}
          onBlur={handleBlur}
          error={fieldError('password')}
          hint={<PasswordRules password={values.password} />}
        />
        <FormField
          name="passwordConfirm"
          type="password"
          label={t('fields.passwordConfirm')}
          autoComplete="new-password"
          value={values.passwordConfirm}
          onChange={handleChange}
          onBlur={handleBlur}
          error={fieldError('passwordConfirm')}
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
          {t(isSubmitting ? 'pages.register.submitting' : 'pages.register.submit')}
        </button>
      </form>

      <p className="auth-page__switch">
        {t('pages.register.haveAccount')}{' '}
        <Link to="/welcome" className="link-accent link-accent--underline">
          {t('auth.login')}
        </Link>
      </p>
    </section>
  );
}
