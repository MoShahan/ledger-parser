import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ToastType = 'ok' | 'error' | 'info';

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
const MAX_TOASTS = 3;

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      setToasts((current) => {
        if (current.some((toast) => toast.type === type && toast.message === message)) {
          return current;
        }
        const id = nextId;
        nextId += 1;
        window.setTimeout(() => dismiss(id), 6000);
        return [...current, { id, type, message }].slice(-MAX_TOASTS);
      });
    },
    [dismiss],
  );

  const value = useMemo<ToastApi>(
    () => ({
      success: (message) => push('ok', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            className={`toast toast-${toast.type}`}
            onClick={() => dismiss(toast.id)}
          >
            {toast.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return ctx;
}
