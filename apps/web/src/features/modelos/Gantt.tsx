import { useMemo, useState } from 'react';
import type { AtividadeCronograma } from '@contro/core';
import styles from './Gantt.module.css';

const PX_DU = 16;

export interface GanttProps {
  itens: AtividadeCronograma[];
  nomes: Record<string, string>;
  predecessoras: Record<string, string[]>;
  total: number;
}

/**
 * Gantt do modelo: a coluna das atividades e a régua de dias ficam congeladas
 * (rola com o mouse nos dois sentidos). Tocar numa barra mostra o dia de início
 * e o de término e realça predecessoras e sucessoras.
 */
export function Gantt({ itens, nomes, predecessoras, total }: GanttProps) {
  const [sel, setSel] = useState<string | null>(null);

  const sucessoras = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const it of itens) m[it.id] = [];
    for (const it of itens) {
      for (const p of predecessoras[it.id] ?? []) {
        if (m[p]) m[p].push(it.id);
      }
    }
    return m;
  }, [itens, predecessoras]);

  const realcadas = useMemo(() => {
    if (!sel) return null;
    const set = new Set<string>([sel]);
    for (const p of predecessoras[sel] ?? []) set.add(p);
    for (const s of sucessoras[sel] ?? []) set.add(s);
    return set;
  }, [sel, predecessoras, sucessoras]);

  const largura = Math.max(total, 1) * PX_DU;
  const marcas = Array.from({ length: Math.floor(total / 5) + 1 }, (_, i) => i * 5);
  const itSel = itens.find((it) => it.id === sel);

  return (
    <div className={styles.gantt}>
      <div className={styles.info} aria-live="polite">
        {itSel ? (
          <>
            <b>{nomes[itSel.id]}</b> · começa no <b>D{itSel.es + 1}</b> e termina no{' '}
            <b>D{itSel.ef}</b> ({itSel.dur} {itSel.dur === 1 ? 'dia útil' : 'dias úteis'})
            {itSel.critico ? ' · caminho crítico' : ''}
          </>
        ) : (
          'Toque numa barra para ver o dia de início e o de término.'
        )}
      </div>

      <div className={styles.rolagem} role="region" aria-label="Gantt do modelo" tabIndex={0}>
        <div className={styles.grade} style={{ gridTemplateColumns: `var(--rotulo) ${largura}px` }}>
          {/* Régua de dias (congelada no topo) */}
          <div className={`${styles.canto} ${styles.cabeca}`}>Atividade</div>
          <div className={`${styles.regua} ${styles.cabeca}`}>
            {marcas.map((d) => (
              <span key={d} className={styles.marca} style={{ left: d * PX_DU }}>
                D{d}
              </span>
            ))}
          </div>

          {itens.map((it) => {
            const dim = realcadas ? !realcadas.has(it.id) : false;
            const on = it.id === sel;
            const alternar = () => setSel((s) => (s === it.id ? null : it.id));
            return (
              <div key={it.id} className={styles.linha} style={{ opacity: dim ? 0.3 : 1 }}>
                {/* Coluna das atividades (congelada à esquerda) */}
                <div
                  className={`${styles.rotulo} ${on ? styles.rotuloOn : ''}`}
                  title={nomes[it.id]}
                >
                  {nomes[it.id] ?? ''}
                </div>
                <div className={styles.trilho}>
                  {marcas.map((d) => (
                    <span key={d} className={styles.guia} style={{ left: d * PX_DU }} />
                  ))}
                  <button
                    type="button"
                    className={`${styles.barra} ${it.critico ? styles.critica : ''} ${on ? styles.barraOn : ''}`}
                    style={{ left: it.es * PX_DU, width: Math.max(it.dur * PX_DU, 6) }}
                    aria-pressed={on}
                    aria-label={`${nomes[it.id] ?? ''}: D${it.es + 1} a D${it.ef}${it.critico ? ', caminho crítico' : ''}`}
                    onClick={alternar}
                  />
                  {on ? (
                    <span
                      className={styles.datas}
                      style={{ left: it.es * PX_DU + Math.max(it.dur * PX_DU, 6) + 6 }}
                    >
                      D{it.es + 1} → D{it.ef}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
