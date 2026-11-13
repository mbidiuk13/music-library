import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LIMITS } from '../utils/validation.js';

//validate має бути стабільною (оголошеною поза компонентом): вона в залежностях useMemo
export default function useForm(initialValues, validate) {
  const { t } = useTranslation();
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [serverErrors, setServerErrorsState] = useState(/** @type {Record<string, string>} */ ({}));

  const errors = useMemo(() => validate(values), [validate, values]);
  const isValid = Object.values(errors).every((error) => !error);

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setServerErrorsState((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }, []);

  const handleBlur = useCallback((event) => {
    const { name } = event.target;
    setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
  }, []);

  const touchAll = useCallback(() => {
    setTouched(Object.fromEntries(Object.keys(initialValues).map((name) => [name, true])));
  }, [initialValues]);

  const setServerErrors = useCallback((details = []) => {
    setServerErrorsState(Object.fromEntries(details.map(({ field, message }) => [field, message])));
  }, []);

  const fieldError = (name) => {
    if (serverErrors[name]) return serverErrors[name];
    if (touched[name] && errors[name]) return t(errors[name], LIMITS);
    return null;
  };

  return { values, isValid, handleChange, handleBlur, fieldError, setServerErrors, touchAll };
}
