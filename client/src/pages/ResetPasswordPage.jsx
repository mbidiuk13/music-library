/**
 * @module pages/ResetPasswordPage
 * @description Встановлення нового пароля за посиланням з листа (UC-10, маршрут
 * `/reset-password?token=…`). Новий пароль перевіряється за тими самими правилами, що й під час
 * реєстрації. Якщо посилання прострочене чи вже використане — повідомлення і пропозиція
 * повторити запит; після успішної зміни — toast-сповіщення і перехід на сторінку входу.
 */

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resetPassword } from '../api/auth.js';
import FormField from '../components/FormField.jsx';
import PasswordRules from '../components/PasswordRules.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useForm from '../hooks/useForm.js';
import { errorMessage } from '../utils/errors.js';
import { validateNewPassword, validatePasswordConfirm } from '../utils/validation.js';

/** Початкові значення полів форми. */
const INITIAL_VALUES = Object.freeze({ password: '', passwordConfirm: '' });

/**
 * Валідація форми — ті самі правила, що й у `POST /api/auth/reset-password`.
 * @param {typeof INITIAL_VALUES} values - значення полів.
 * @returns {Record<string, string|null>} ключі i18n помилок полів.
 */
function validateReset({ password, passwordConfirm }) {
  return {
    password: validateNewPassword(password),
    passwordConfirm: validatePasswordConfirm(password, passwordConfirm),
  };
}

/**
 * Повідомлення про недійсне посилання з пропозицією надіслати нове.
 * @returns {JSX.Element} блок повідомлення.
 */
function InvalidLink() {
  const { t } = useTranslation();
  return (
    <>
      <p className="notice notice--error" role="alert">
        {t('errors.codes.INVALID_RESET_TOKEN')}
      </p>
      <Link to="/forgot-password" className="btn-primary btn-primary--block">
        {t('pages.resetPassword.requestAgain')}
      </Link>
    </>
  );
}

/**
 * Сторінка встановлення нового пароля.
 * @returns {JSX.Element} сторінка.
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const { values, isValid, handleChange, handleBlur, fieldError, setServerErrors, touchAll } =
    useForm(INITIAL_VALUES, validateReset);
  const [formError, setFormError] = useState(/** @type {string|null} */ (null));
  const [isTokenInvalid, setIsTokenInvalid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Надсилає новий пароль разом із токеном з посилання.
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
      await resetPassword({
        token,
        password: values.password,
        passwordConfirm: values.passwordConfirm,
      });
      showToast(t('pages.welcome.notices.passwordChanged'));
      navigate('/welcome', { replace: true });
    } catch (err) {
      setIsSubmitting(false);
      const tokenRejected =
        err.code === 'INVALID_RESET_TOKEN' || err.details?.some(({ field }) => field === 'token');
      if (tokenRejected) {
        setIsTokenInvalid(true);
        return;
      }
      setServerErrors(err.details);
      setFormError(errorMessage(err));
    }
  };

  return (
    <section className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t('pages.resetPassword.title')}</h1>
        <p className="auth-page__subtitle">{t('pages.resetPassword.subtitle')}</p>
      </header>

      {!token || isTokenInvalid ? (
        <InvalidLink />
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <FormField
            name="password"
            type="password"
            label={t('fields.newPassword')}
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
            {t(isSubmitting ? 'pages.resetPassword.submitting' : 'pages.resetPassword.submit')}
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
