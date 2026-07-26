import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface ToastItem {
  id: number;
  message: string;
  kind: 'ok' | 'error';
}

const ToastContext = createContext<(message: string, kind?: 'ok' | 'error') => void>(
  () => {},
);

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, kind: 'ok' | 'error' = 'ok') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      kind === 'error' ? 5000 : 2200,
    );
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
