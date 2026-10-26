import { useRef, useState } from 'react';
import { pendenteHa } from '@contro/core';
import { Icon } from '@contro/ui';
import { hojeISO } from './api';
import type { PendenciaObra } from './pendenciasObra';
import styles from './PendenciaDeck.module.css';

const LIMIAR = 100; // px (SPEC §5.7)

const CRIT_ROTULO: Record<string, string> = { alta: 'alta', media: 'média', baixa: 'baixa' };

/** "22/10 09:14" a partir do timestamp do apontamento. */
function quando(iso: string): string {
  const d = new Date(iso);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** Fila de pendências em cartões (protótipo · PENDÊNCIAS): arraste ou use os botões. */
export function PendenciaDeck({
  pendencias,
  onResolver,
  onAdiar,
}: {
  pendencias: PendenciaObra[];
  onResolver: (p: PendenciaObra) => void;
  onAdiar: (p: PendenciaObra) => void;
}) {
  const [dx, setDx] = useState(0);
  const inicio = useRef<number | null>(null);
  const topo = pendencias[0];

  function soltar() {
    if (topo && dx >= LIMIAR) onResolver(topo);
    else if (topo && dx <= -LIMIAR) onAdiar(topo);
    setDx(0);
    inicio.current = null;
  }

  return (
    <div className={styles.deck}>
      <div className={styles.pilha}>
        {pendencias.length > 1 ? <div className={styles.cardAtras} aria-hidden="true" /> : null}

        {topo ? (
          <div
            className={styles.cardTopo}
            style={{
              transform: `translateX(${dx}px) rotate(${dx / 22}deg)`,
              transition: inicio.current === null ? 'transform 0.2s' : 'none',
            }}
            onPointerDown={(e) => {
              inicio.current = e.clientX;
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (inicio.current !== null) setDx(e.clientX - inicio.current);
            }}
            onPointerUp={soltar}
            onPointerCancel={() => {
              setDx(0);
              inicio.current = null;
            }}
          >
            <div className={styles.foto}>
              {topo.fotoAntesUrl ? <img src={topo.fotoAntesUrl} alt="" draggable={false} /> : null}
              <span className={styles.antes}>ANTES · {quando(topo.apontada_em)}</span>
              <span
                className={`${styles.crit} ${topo.criticidade === 'alta' ? styles.critAlta : ''}`}
              >
                Criticidade {CRIT_ROTULO[topo.criticidade]}
              </span>
              {topo.local ? <span className={styles.legenda}>{topo.local}</span> : null}
              <span
                className={styles.seloOk}
                style={{ opacity: Math.max(0, Math.min(1, dx / LIMIAR)) }}
              >
                RESOLVIDA
              </span>
              <span
                className={styles.seloAdiar}
                style={{ opacity: Math.max(0, Math.min(1, -dx / LIMIAR)) }}
              >
                ADIAR
              </span>
            </div>
            <div className={styles.corpo}>
              <div className={styles.titulo}>{topo.titulo}</div>
              <div className={styles.onde}>
                {[topo.local, topo.atividadeNome ?? 'Geral'].filter(Boolean).join(' · ')}
              </div>
              <div className={styles.meta}>
                {topo.apontouNome ? `Apontado por ${topo.apontouNome} · ` : ''}pendente há{' '}
                {pendenteHa(topo.apontada_em, hojeISO())}
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.vazio}>
            <span className={styles.vazioIcone}>
              <Icon name="checkGrosso" size={28} strokeWidth={2.6} />
            </span>
            <div className={styles.vazioTitulo}>Fila zerada</div>
            <div className={styles.vazioTexto}>
              Nenhuma pendência aberta nesta obra. Use Apontar para registrar uma nova com foto.
            </div>
          </div>
        )}
      </div>

      <div className={styles.botoes}>
        <button
          type="button"
          className={styles.btnAdiar}
          disabled={!topo}
          onClick={() => topo && onAdiar(topo)}
        >
          <Icon name="chevronLeft" size={18} strokeWidth={2.2} />
          Adiar
        </button>
        <button
          type="button"
          className={styles.btnResolver}
          disabled={!topo}
          onClick={() => topo && onResolver(topo)}
        >
          Resolvida
          <Icon name="chevronRight" size={18} strokeWidth={2.2} />
        </button>
      </div>
      <div className={styles.dica}>
        Arraste: direita resolve com foto · esquerda adia com data e motivo
      </div>
    </div>
  );
}
