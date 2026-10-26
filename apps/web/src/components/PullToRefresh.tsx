import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@contro/ui';
import styles from './PullToRefresh.module.css';

const LIMITE = 72; // px puxados (já amortecidos) para disparar
const MAX = 96; // teto visual da puxada
const AMORTECIMENTO = 0.5; // resistência: metade do dedo vira puxada

interface Props {
  /** Chamado ao soltar além do limite. A animação fica até a promessa resolver. */
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

/**
 * "Puxar pra atualizar" (mobile). Envolve o scroller principal: arrastar pra
 * baixo com a lista no topo revela o indicador; ao soltar além do limite,
 * dispara `onRefresh`. Só engata quando o conteúdo já está no topo, então não
 * atrapalha a rolagem normal.
 */
export function PullToRefresh({ onRefresh, children }: Props) {
  const scroller = useRef<HTMLElement>(null);
  const [puxada, setPuxadaState] = useState(0);
  const [atualizando, setAtualizando] = useState(false);

  // Espelhos em ref para os handlers (que são ligados uma vez só) lerem o
  // valor vivo sem recriar os listeners a cada render.
  const puxadaRef = useRef(0);
  const arrastandoRef = useRef(false);
  const atualizandoRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const setPuxada = (v: number) => {
    puxadaRef.current = v;
    setPuxadaState(v);
  };

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    let inicioY = 0;

    const onStart = (e: TouchEvent) => {
      if (atualizandoRef.current || e.touches.length !== 1) return;
      if (el.scrollTop <= 0) {
        arrastandoRef.current = true;
        inicioY = e.touches[0].clientY;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (!arrastandoRef.current) return;
      const delta = e.touches[0].clientY - inicioY;
      if (delta <= 0) {
        // Rolando pra cima: devolve o controle à rolagem nativa.
        if (puxadaRef.current !== 0) setPuxada(0);
        return;
      }
      // Puxando pra baixo no topo: segura o overscroll nativo e mostra o indicador.
      e.preventDefault();
      setPuxada(Math.min(delta * AMORTECIMENTO, MAX));
    };

    const onEnd = () => {
      if (!arrastandoRef.current) return;
      arrastandoRef.current = false;
      if (puxadaRef.current >= LIMITE) {
        atualizandoRef.current = true;
        setAtualizando(true);
        setPuxada(LIMITE);
        void onRefreshRef.current().finally(() => {
          atualizandoRef.current = false;
          setAtualizando(false);
          setPuxada(0);
        });
      } else {
        setPuxada(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const altura = atualizando ? LIMITE : puxada;
  const mostrarIcone = altura > 0;
  const giro = Math.min(puxada / LIMITE, 1) * 270;

  return (
    <main ref={scroller} className="app-main">
      <div
        className={styles.indicador}
        style={{
          height: altura,
          // Transição só ao soltar; durante o arraste acompanha o dedo sem atraso.
          transition: arrastandoRef.current ? 'none' : 'height 180ms ease',
        }}
        aria-hidden={!mostrarIcone}
      >
        {mostrarIcone ? (
          <span
            className={atualizando ? styles.girando : styles.icone}
            style={atualizando ? undefined : { transform: `rotate(${giro}deg)` }}
          >
            <Icon name="sync" size={22} />
          </span>
        ) : null}
      </div>
      {children}
    </main>
  );
}
