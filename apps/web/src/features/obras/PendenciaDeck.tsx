import { useEffect, useRef, useState } from 'react';
import { pendenteHa, proximaPendencia } from '@contro/core';
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

/**
 * Pendências, uma foto por vez (pedido do usuário, 28/10/2026): deslizar para a
 * esquerda (ou "Resolvida") abre a câmera do depois; para a direita (ou
 * "Próxima") só passa para a próxima foto. Sem adiar.
 */
export function PendenciaDeck({
  pendencias,
  onResolver,
  onMais,
  onFoto,
}: {
  pendencias: PendenciaObra[];
  onResolver: (p: PendenciaObra) => void;
  onMais: (p: PendenciaObra) => void;
  onFoto: (p: PendenciaObra) => void;
}) {
  const [indice, setIndice] = useState(0);
  const [dx, setDx] = useState(0);
  const inicio = useRef<number | null>(null);
  // A lista muda (resolveu, apontou, apagou): mantém o índice dentro dela.
  useEffect(() => {
    if (indice >= pendencias.length) setIndice(0);
  }, [indice, pendencias.length]);
  const atual = pendencias[Math.min(indice, Math.max(0, pendencias.length - 1))];
  const total = pendencias.length;

  function proxima() {
    setIndice((i) => proximaPendencia(i, total));
  }

  function soltar() {
    if (atual && dx <= -LIMIAR) onResolver(atual);
    else if (atual && dx >= LIMIAR && total > 1) proxima();
    setDx(0);
    inicio.current = null;
  }

  return (
    <div className={styles.deck}>
      {total ? (
        <div className={styles.contador}>
          <span>
            {Math.min(indice, total - 1) + 1} de {total} · altas primeiro
          </span>
          <span className={styles.pontos} aria-hidden="true">
            {pendencias.slice(0, 8).map((p, i) => (
              <span key={p.id} className={i === indice ? styles.pontoOn : styles.ponto} />
            ))}
          </span>
        </div>
      ) : null}

      <div className={styles.pilha}>
        {total > 1 ? <div className={styles.cardAtras} aria-hidden="true" /> : null}

        {atual ? (
          <div
            key={atual.id}
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
            onPointerUp={() => {
              // Toque sem arrastar na foto: amplia.
              if (Math.abs(dx) < 6 && inicio.current !== null) {
                inicio.current = null;
                setDx(0);
                return;
              }
              soltar();
            }}
            onPointerCancel={() => {
              setDx(0);
              inicio.current = null;
            }}
          >
            <div className={styles.foto}>
              {atual.fotoAntesUrl ? (
                <img
                  src={atual.fotoAntesUrl}
                  alt=""
                  draggable={false}
                  onClick={() => Math.abs(dx) < 6 && onFoto(atual)}
                />
              ) : null}
              <span className={styles.antes}>ANTES · {quando(atual.apontada_em)}</span>
              <span
                className={`${styles.crit} ${atual.criticidade === 'alta' ? styles.critAlta : ''}`}
              >
                Criticidade {CRIT_ROTULO[atual.criticidade]}
              </span>
              <span
                className={styles.seloOk}
                style={{ opacity: Math.max(0, Math.min(1, -dx / LIMIAR)) }}
              >
                RESOLVIDA
              </span>
              <span
                className={styles.seloProx}
                style={{ opacity: total > 1 ? Math.max(0, Math.min(1, dx / LIMIAR)) : 0 }}
              >
                PRÓXIMA
              </span>
            </div>
            <div className={styles.corpo}>
              <div className={styles.corpoTexto}>
                <div className={styles.titulo}>{atual.titulo}</div>
                <div className={styles.onde}>
                  {[atual.local, atual.atividadeNome ?? 'Geral'].filter(Boolean).join(' · ')}
                </div>
                <div className={styles.meta}>
                  {atual.apontouNome ? `Apontado por ${atual.apontouNome} · ` : ''}pendente há{' '}
                  {pendenteHa(atual.apontada_em, hojeISO())}
                </div>
              </div>
              <button
                type="button"
                className={styles.mais}
                aria-label={`Mais opções de "${atual.titulo}"`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onMais(atual)}
              >
                <Icon name="more" size={22} />
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.vazio}>
            <span className={styles.vazioIcone}>
              <Icon name="checkGrosso" size={28} strokeWidth={2.6} />
            </span>
            <div className={styles.vazioTitulo}>Nada pendente</div>
            <div className={styles.vazioTexto}>
              Nenhuma pendência aberta nesta obra. Use a câmera para apontar uma nova.
            </div>
          </div>
        )}
      </div>

      <div className={styles.botoes}>
        <button
          type="button"
          className={styles.btnResolver}
          disabled={!atual}
          onClick={() => atual && onResolver(atual)}
        >
          <Icon name="chevronLeft" size={18} strokeWidth={2.2} />
          <Icon name="camera" size={18} strokeWidth={2} />
          Resolvida
        </button>
        <button type="button" className={styles.btnProx} disabled={total < 2} onClick={proxima}>
          Próxima
          <Icon name="chevronRight" size={18} strokeWidth={2.2} />
        </button>
      </div>
      <div className={styles.dica}>
        Deslize: esquerda resolve com foto · direita passa para a próxima
      </div>
    </div>
  );
}
