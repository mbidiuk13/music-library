import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resetPassword, verifyResetToken } from '../api/auth.js';
import FormField from '../components/FormField.jsx';
import PasswordRules from '../components/PasswordRules.jsx';
import { LoadingState, RequestError } from '../components/RequestState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useForm from '../hooks/useForm.js';
import useRequest from '../hooks/useRequest.js';
import { errorMessage } from '../utils/errors.js';
import { validateNewPassword, validatePasswordConfirm } from '../utils/validation.js';

const INITIAL_VALUES = Object.freeze({ password: '', passwordConfirm: '' });

function validateReset({ password, passwordConfirm }) {
  return {
    password: validateNewPassword(password),
    passwordConfirm: validatePasswordConfirm(password, passwordConfirm),
  };
}

function isTokenRejected(err) {
  return (
    err?.code === 'INVALID_RESET_TOKEN' ||
    Boolean(err?.details?.some(({ field }) => field === 'token'))
  );
}

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

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  /*посилання перевіряється одразу, щоб недійсне виявити ще до заповнення форми;
  без токена перевіряти нічого — одразу показується повідомлення*/
  const loadVerification = useMemo(
    () => (token ? (signal) => verifyResetToken(token, signal) : null),
    [token],
  );
  const verification = useRequest(loadVerification);

  const { values, isValid, handleChange, handleBlur, fieldError, setServerErrors, touchAll } =
    useForm(INITIAL_VALUES, validateReset);
  const [formError, setFormError] = useState(/** @type {string|null} */ (null));
  const [isTokenInvalid, setIsTokenInvalid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      //посилання могло стати недійсним, поки форма була відкрита
      if (isTokenRejected(err)) {
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

      {!token || isTokenInvalid || isTokenRejected(verification.error) ? (
        <InvalidLink />
      ) : verification.isLoading ? (
        <LoadingState />
      ) : verification.error ? (
        <RequestError error={verification.error} onRetry={verification.reload} />
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
