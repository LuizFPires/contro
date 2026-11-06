import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './BottomSheet.module.css';

export interface BottomSheetProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

// Trava da tela de trás. No iPhone, `overflow: hidden` no body não impede o dedo de
// rolar a página; fixar o body na posição atual impede. Contador: com folha aberta
// sobre folha, só a última a fechar destrava, e a página volta para onde estava.
let travas = 0;
let rolagemAntes = 0;
let estiloAntes: string | null = null;

function travarFundo() {
  travas += 1;
  if (travas > 1) return;
  const b = document.body;
  rolagemAntes = window.scrollY;
  estiloAntes = b.getAttribute('style');
  b.style.position = 'fixed';
  b.style.top = `-${rolagemAntes}px`;
  b.style.left = '0';
  b.style.right = '0';
  b.style.width = '100%';
  b.style.overflow = 'hidden';
}

function destravarFundo() {
  travas = Math.max(0, travas - 1);
  if (travas > 0) return;
  const b = document.body;
  if (estiloAntes) b.setAttribute('style', estiloAntes);
  else b.removeAttribute('style');
  window.scrollTo(0, rolagemAntes);
}

export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  // onClose costuma vir como função nova a cada render. Guardado em ref, o efeito
  // abaixo roda só ao abrir/fechar: se dependesse de onClose, cada tecla digitada
  // num campo da folha (que redesenha o pai) devolvia o foco para a folha e o
  // texto "saía" do input.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);

    // Trava o scroll do fundo e move o foco para dentro do sheet.
    const anterior = document.activeElement as HTMLElement | null;
    travarFundo();
    sheetRef.current?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener('keydown', onKey);
      destravarFundo();
      anterior?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.grabber} aria-hidden="true" />
        {title ? (
          <div className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <button type="button" className={styles.close} aria-label="Fechar" onClick={onClose}>
              <Icon name="close" size={22} />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
