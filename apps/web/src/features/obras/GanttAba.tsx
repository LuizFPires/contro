import { useMemo, useState } from 'react';
import { diaMes, type StatusAtividadeTrilha } from '@contro/core';
import type { ObraCompleta } from './detalhe';
import { montarTrilha } from './trilhaObra';
import styles from './GanttAba.module.css';

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const SITUACAO: Record<StatusAtividadeTrilha, string> = {
  concluida: 'Concluída',
  atrasada: 'Atrasada',
  liberada: 'Liberada',
  aguardando: 'Aguardando providência',
  planejada: 'Planejada',
};

/** Cronograma por fase (protótipo · CRONOGRAMA): barras, linha de hoje e detalhe ao tocar. */
export function GanttAba({
  obra,
  onAbrir,
}: {
  obra: ObraCompleta;
  onAbrir: (atividadeId: string) => void;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  const fases = useMemo(() => montarTrilha(obra), [obra]);
  const total = obra.cron.total || 1;
  const hojePct = clamp(obra.decorridos / total, 0, 1) * 100;

  const porId = useMemo(() => new Map(obra.atividades.map((a) => [a.id, a])), [obra]);
  const liberaPor = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of obra.atividades) {
      if (a.pai_id) continue;
      for (const p of a.predecessoras) m.set(p, [...(m.get(p) ?? []), a.nome]);
    }
    return m;
  }, [obra]);

  return (
    <div className={styles.aba}>
      <div className={styles.legenda}>
        <span>
          <i className={styles.concluida} />
          Concluída
        </span>
        <span>
          <i className={styles.liberada} />
          Liberada
        </span>
        <span className={styles.lgAtraso}>
          <i className={styles.atrasada} />
          Atrasada
        </span>
        <span>
          <i className={styles.planejada} />
          Planejada
        </span>
        <span>
          <i className={styles.lgHoje} />
          Hoje
        </span>
      </div>

      {fases.map((f) =>
        f.atividades.length ? (
          <div key={f.id} className={styles.fase}>
            <div className={styles.faseTitulo}>
              Fase {f.n} · {f.titulo}
            </div>
            {f.atividades.map((t) => {
              const a = porId.get(t.id);
              const c = obra.cron.porId[t.id];
              const sel = aberta === t.id;
              const left = c ? (c.es / total) * 100 : 0;
              const width = c ? Math.max((c.dur / total) * 100, 2) : 2;
              const cor = t.status === 'aguardando' ? 'planejada' : t.status;
              const provs = a?.providencias ?? [];
              const feitas = provs.filter((p) => p.status === 'feito').length;
              const deps = (a?.predecessoras ?? []).map((p) => porId.get(p)?.nome).filter(Boolean);
              return (
                <div key={t.id} className={`${styles.row} ${sel ? styles.rowSel : ''}`}>
                  <button
                    type="button"
                    className={styles.rowBtn}
                    aria-expanded={sel}
                    onClick={() => setAberta(sel ? null : t.id)}
                  >
                    <span className={styles.rowTopo}>
                      <span
                        className={`${styles.nome} ${t.status === 'atrasada' ? styles.txtAtraso : ''}`}
                      >
                        {t.nome}
                      </span>
                      <span
                        className={`${styles.datas} ${t.status === 'atrasada' ? styles.datasAtraso : ''}`}
                      >
                        {c ? `${diaMes(c.inicio_previsto)}–${diaMes(c.fim_previsto)}` : ''}
                      </span>
                    </span>
                    <span className={styles.trilho} aria-hidden="true">
                      <span
                        className={`${styles.barra} ${styles[cor]}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                      <span className={styles.hoje} style={{ left: `${hojePct}%` }} />
                    </span>
                    <span className="sr-only">{SITUACAO[t.status]}</span>
                  </button>
                  {sel ? (
                    <div className={styles.detalhe}>
                      <div>
                        <strong>Situação:</strong> {SITUACAO[t.status]}
                      </div>
                      <div>
                        <strong>Prestador:</strong> {a?.prestador ?? 'não definido'}
                      </div>
                      <div>
                        <strong>Providências:</strong>{' '}
                        {provs.length ? `${feitas} de ${provs.length} providenciadas` : 'nenhuma'}
                      </div>
                      <div>
                        <strong>Depende de:</strong> {deps.length ? deps.join(', ') : 'nada'}
                      </div>
                      <div>
                        <strong>Libera:</strong> {(liberaPor.get(t.id) ?? []).join(', ') || 'nada'}
                      </div>
                      <button type="button" className={styles.abrir} onClick={() => onAbrir(t.id)}>
                        Abrir ficha da atividade
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null,
      )}
    </div>
  );
}
