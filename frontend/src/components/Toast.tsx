import { createContext, ReactNode, useContext, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all',
              t.tone === 'success' && 'border-green-200 bg-green-50 text-green-800',
              t.tone === 'error' && 'border-red-200 bg-red-50 text-red-800',
              t.tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800',
              t.tone === 'info' && 'border-sky-200 bg-sky-50 text-sky-800',
            )}
          >
            <span className="text-sm font-medium">{t.message}</span>
            <button aria-label="Закрыть" className="ml-2 opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
