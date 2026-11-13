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

const TOAST_DURATION_MS = 4000;
const MAX_TOASTS = 3;

const ToastContext = createContext(/** @type {object|null} */ (null));

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState(/** @type {object[]} */ ([]));
  const nextIdRef = useRef(0);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timersRef.current.get(id));
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

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

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
