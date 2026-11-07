/**
 * @module context/ToastContext
 * @description Toast-сповіщення про успішні дії (розділ 9 SPEC «Стани UI»): «Плейлист створено»,
 * «Трек додано», «Трек завантажено» тощо. Сповіщення з'являється в кутку екрана і зникає саме
 * через кілька секунд. Провайдер розташований над маршрутами (main.jsx), тому сповіщення
 * не зникає під час переходу на іншу сторінку (напр. після реєстрації — на сторінку входу).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Toaster from '../components/Toaster.jsx';

/** Скільки мілісекунд сповіщення лишається на екрані. */
const TOAST_DURATION_MS = 4000;

/** Найбільша кількість сповіщень на екрані одночасно (старіші прибираються). */
const MAX_TOASTS = 3;

/**
 * @typedef {object} Toast
 * @property {number} id - номер сповіщення.
 * @property {string} message - текст (уже перекладений).
 * @property {'success'|'error'} type - вид сповіщення.
 */

/**
 * @typedef {object} ToastContextValue
 * @property {(message: string, options?: {type?: 'success'|'error'}) => void} showToast -
 *   показати сповіщення.
 */

const ToastContext = createContext(/** @type {ToastContextValue|null} */ (null));

/**
 * Провайдер сповіщень: зберігає список сповіщень і рендерить їх контейнер.
 * @param {{children: import('react').ReactNode}} props - дочірні елементи.
 * @returns {JSX.Element} провайдер контексту з контейнером сповіщень.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState(/** @type {Toast[]} */ ([]));
  const nextIdRef = useRef(0);
  /** Таймери автоматичного закриття за id сповіщення. */
  const timersRef = useRef(new Map());

  /**
   * Прибирає сповіщення (за таймером або кнопкою «Закрити»).
   * @param {number} id - номер сповіщення.
   * @returns {void}
   */
  const dismiss = useCallback((id) => {
    clearTimeout(timersRef.current.get(id));
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /** @type {ToastContextValue['showToast']} */
  const showToast = useCallback(
    (message, { type = 'success' } = {}) => {
      const id = ++nextIdRef.current;
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, message, type }]);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION_MS),
      );
    },
    [dismiss],
  );

  // Під час демонтування провайдера скасовуються всі таймери.
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Хук для показу сповіщень.
 * @returns {ToastContextValue} значення контексту.
 * @throws {Error} якщо викликано поза ToastProvider.
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
