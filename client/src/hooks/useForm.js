/**
 * @module hooks/useForm
 * @description Стан форми: значення полів, клієнтська валідація, «торкнуті» поля
 * і помилки окремих полів, які повернув сервер (`details` у відповіді 400).
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LIMITS } from '../utils/validation.js';

/**
 * Хук стану форми.
 * @template {Record<string, string>} T
 * @param {T} initialValues - початкові значення полів.
 * @param {(values: T) => Partial<Record<keyof T, string|null>>} validate - функція валідації:
 *   повертає для кожного поля ключ i18n помилки або null. Має бути стабільною (оголошеною поза компонентом).
 * @returns {{
 *   values: T,
 *   isValid: boolean,
 *   handleChange: (event: import('react').ChangeEvent<HTMLInputElement>) => void,
 *   handleBlur: (event: import('react').FocusEvent<HTMLInputElement>) => void,
 *   fieldError: (name: keyof T) => string|null,
 *   setServerErrors: (details?: {field: string, message: string}[]) => void,
 *   touchAll: () => void,
 * }} стан і обробники форми.
 */
export default function useForm(initialValues, validate) {
  const { t } = useTranslation();
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [serverErrors, setServerErrorsState] = useState(/** @type {Record<string, string>} */ ({}));

  const errors = useMemo(() => validate(values), [validate, values]);
  const isValid = Object.values(errors).every((error) => !error);

  /**
   * Оновлює значення поля і знімає серверну помилку цього поля.
   * @param {import('react').ChangeEvent<HTMLInputElement>} event - подія зміни.
   * @returns {void}
   */
  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setServerErrorsState((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }, []);

  /**
   * Позначає поле як «торкнуте»: після цього його помилка показується.
   * @param {import('react').FocusEvent<HTMLInputElement>} event - подія втрати фокуса.
   * @returns {void}
   */
  const handleBlur = useCallback((event) => {
    const { name } = event.target;
    setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
  }, []);

  /**
   * Позначає всі поля як «торкнуті» (напр. перед надсиланням).
   * @returns {void}
   */
  const touchAll = useCallback(() => {
    setTouched(Object.fromEntries(Object.keys(initialValues).map((name) => [name, true])));
  }, [initialValues]);

  /**
   * Зберігає помилки полів із відповіді сервера (`details: [{field, message}]`).
   * @param {{field: string, message: string}[]} [details] - помилки полів.
   * @returns {void}
   */
  const setServerErrors = useCallback((details = []) => {
    setServerErrorsState(Object.fromEntries(details.map(({ field, message }) => [field, message])));
  }, []);

  /**
   * Текст помилки поля для показу: серверна помилка або (для «торкнутого» поля) клієнтська.
   * @param {keyof T} name - назва поля.
   * @returns {string|null} перекладене повідомлення або null.
   */
  const fieldError = (name) => {
    if (serverErrors[name]) return serverErrors[name];
    if (touched[name] && errors[name]) return t(errors[name], LIMITS);
    return null;
  };

  return { values, isValid, handleChange, handleBlur, fieldError, setServerErrors, touchAll };
}
