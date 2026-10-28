import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@contro/ui';
import styles from './FotoViewer.module.css';

export interface FotoAmpliada {
  rotulo: string;
  url: string;
}

const MAX = 5;
const ZOOM_DUPLO = 2.5;

/**
 * Foto em tela cheia (Check list: antes e depois). Dois dedos ampliam, toque
 * duplo alterna o zoom, arrastar move a foto ampliada. Sem zoom, deslizar para
 * o lado troca entre antes e depois.
 */
export function FotoViewer({
  fotos,
  inicial = 0,
  titulo,
  onFechar,
}: {
  fotos: FotoAmpliada[];
  inicial?: number;
  titulo?: string;
  onFechar: () => void;
}) {
  const [idx, setIdx] = useState(Math.min(inicial, fotos.length - 1));
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const ponteiros = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef({ dist: 0, s: 1, swipe: 0, moveu: false, ultimoToque: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
      if (e.key === 'ArrowRight') ir(idx + 1);
      if (e.key === 'ArrowLeft') ir(idx - 1);
    };
    document.addEventListener('keydown', onKey);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = antes;
    };
  });

  function ir(n: number) {
    if (n < 0 || n >= fotos.length) return;
    setIdx(n);
    setZ({ s: 1, x: 0, y: 0 });
  }

  const distancia = () => {
    const [a, b] = [...ponteiros.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function onDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesto.current.moveu = false;
    gesto.current.swipe = 0;
    if (ponteiros.current.size === 2) {
      gesto.current.dist = distancia();
      gesto.current.s = z.s;
    }
  }

  function onMove(e: React.PointerEvent) {
    const antes = ponteiros.current.get(e.pointerId);
    if (!antes) return;
    const dx = e.clientX - antes.x;
    const dy = e.clientY - antes.y;
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.abs(dx) + Math.abs(dy) > 2) gesto.current.moveu = true;
    if (ponteiros.current.size === 2 && gesto.current.dist > 0) {
      const s = Math.min(MAX, Math.max(1, (gesto.current.s * distancia()) / gesto.current.dist));
      setZ((v) => (s === 1 ? { s: 1, x: 0, y: 0 } : { ...v, s }));
    } else if (ponteiros.current.size === 1) {
      if (z.s > 1) setZ((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      else gesto.current.swipe += dx;
    }
  }

  function onUp(e: React.PointerEvent) {
    ponteiros.current.delete(e.pointerId);
    if (ponteiros.current.size > 0) return;
    const g = gesto.current;
    if (z.s === 1 && Math.abs(g.swipe) > 60) {
      ir(g.swipe < 0 ? idx + 1 : idx - 1);
      return;
    }
    if (!g.moveu) {
      // Toque duplo: amplia no ponto tocado ou volta ao tamanho normal.
      const agora = Date.now();
      if (agora - g.ultimoToque < 300) {
        if (z.s > 1) setZ({ s: 1, x: 0, y: 0 });
        else {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const cx = e.clientX - (r.left + r.width / 2);
          const cy = e.clientY - (r.top + r.height / 2);
          setZ({ s: ZOOM_DUPLO, x: -cx * (ZOOM_DUPLO - 1), y: -cy * (ZOOM_DUPLO - 1) });
        }
        g.ultimoToque = 0;
      } else g.ultimoToque = agora;
    }
  }

  const foto = fotos[idx];
  if (!foto) return null;

  return createPortal(
    <div className={styles.fundo} role="dialog" aria-modal="true" aria-label={titulo ?? 'Foto'}>
      <div className={styles.topo}>
        <div className={styles.titulo}>{titulo}</div>
        <button type="button" className={styles.fechar} aria-label="Fechar foto" onClick={onFechar}>
          <Icon name="close" size={26} />
        </button>
      </div>

      {fotos.length > 1 ? (
        <div className={styles.abas} role="tablist" aria-label="Antes e depois">
          {fotos.map((f, i) => (
            <button
              key={f.rotulo}
              type="button"
              role="tab"
              aria-selected={i === idx}
              className={`${styles.aba} ${i === idx ? styles.abaOn : ''}`}
              onClick={() => ir(i)}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={styles.palco}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <img
          src={foto.url}
          alt={foto.rotulo}
          draggable={false}
          className={styles.img}
          style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.s})` }}
        />
      </div>

      <div className={styles.rodape}>
        <span className={styles.rotulo}>{foto.rotulo.toUpperCase()}</span>
        {z.s > 1 ? (
          <button type="button" className={styles.reset} onClick={() => setZ({ s: 1, x: 0, y: 0 })}>
            <Icon name="undo" size={16} />
            Tamanho normal
          </button>
        ) : (
          <span className={styles.dica}>Dois dedos ou toque duplo para ampliar</span>
        )}
      </div>
    </div>,
    document.body,
  );
}
