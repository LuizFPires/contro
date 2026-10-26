import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Toast.module.css';

export interface ToastOptions {
  message: string;
  /** Rótulo da ação de desfazer. Padrão: "Desfazer". */
  undoLabel?: string;
  /** Se presente, mostra o botão de desfazer e chama isto ao tocar. */
  onUndo?: () => void;
  /** Duração em ms. Padrão: 5000 (toast de 5 s). */
  duration?: number;
}

interface ActiveToast extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback(
    (opts: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      const id = ++seq.current;
      setToast({ ...opts, id });
      timer.current = setTimeout(clear, opts.duration ?? 5000);
    },
    [clear],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const handleUndo = () => {
    toast?.onUndo?.();
    clear();
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <div className={styles.region}>
          <div className={styles.toast} role="status" aria-live="polite">
            <span className={styles.marca} aria-hidden="true">
              <Icon name="checkGrosso" size={14} strokeWidth={3} />
            </span>
            <span className={styles.message}>{toast.message}</span>
            {toast.onUndo ? (
              <button type="button" className={styles.undo} onClick={handleUndo}>
                <Icon name="undo" size={18} />
                {toast.undoLabel ?? 'Desfazer'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa de um <ToastProvider> acima.');
  return ctx;
}
