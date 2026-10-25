import { useMemo, useState } from 'react';
import type { AtividadeCronograma } from '@obdc/core';

const ROW_H = 26;
const LABEL_W = 220;
const PX_DU = 16;
const PAD = 8;

export interface GanttProps {
  itens: AtividadeCronograma[];
  nomes: Record<string, string>;
  predecessoras: Record<string, string[]>;
  total: number;
}

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

  const width = LABEL_W + total * PX_DU + PAD * 2;
  const height = itens.length * ROW_H + PAD * 2 + 16;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Gantt do modelo"
        style={{ fontFamily: 'var(--obdc-font)', display: 'block' }}
      >
        {/* grade vertical a cada 5 du */}
        {Array.from({ length: Math.floor(total / 5) + 1 }, (_, i) => i * 5).map((d) => (
          <g key={d}>
            <line
              x1={LABEL_W + d * PX_DU + PAD}
              y1={PAD}
              x2={LABEL_W + d * PX_DU + PAD}
              y2={height - PAD}
              stroke="var(--obdc-border)"
            />
            <text
              x={LABEL_W + d * PX_DU + PAD + 2}
              y={height - PAD}
              fontSize="10"
              fill="var(--obdc-muted)"
            >
              {d}
            </text>
          </g>
        ))}

        {itens.map((it, i) => {
          const y = PAD + i * ROW_H;
          const x = LABEL_W + it.es * PX_DU + PAD;
          const w = Math.max(it.dur * PX_DU, 4);
          const dim = realcadas ? !realcadas.has(it.id) : false;
          const cor = it.critico ? 'var(--obdc-turquoise)' : 'var(--obdc-black)';
          return (
            <g
              key={it.id}
              role="button"
              tabIndex={0}
              aria-label={`${nomes[it.id] ?? ''}${it.critico ? ', caminho crítico' : ''}`}
              onClick={() => setSel((s) => (s === it.id ? null : it.id))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSel((s) => (s === it.id ? null : it.id));
                }
              }}
              style={{ cursor: 'pointer', opacity: dim ? 0.3 : 1 }}
            >
              <text
                x={PAD}
                y={y + ROW_H / 2 + 4}
                fontSize="12"
                fontWeight={it.id === sel ? 800 : 600}
                fill="var(--obdc-text)"
              >
                {(nomes[it.id] ?? '').slice(0, 30)}
              </text>
              <rect
                x={x}
                y={y + 4}
                width={w}
                height={ROW_H - 10}
                rx={4}
                fill={cor}
                stroke={it.id === sel ? 'var(--obdc-black)' : 'none'}
                strokeWidth={it.id === sel ? 2 : 0}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
