import { Card } from '@obdc/ui';
import type { ObraCompleta } from './detalhe';
import styles from './GanttAba.module.css';

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Gantt simplificado por fase (SPEC §5.8). Cores por estado; linha de hoje; tocar abre a ficha. */
export function GanttAba({
  obra,
  onAbrir,
}: {
  obra: ObraCompleta;
  onAbrir: (atividadeId: string) => void;
}) {
  const total = obra.cron.total || 1;
  const hojePct = clamp(obra.decorridos / total, 0, 1) * 100;
  const topo = obra.atividades.filter((a) => !a.pai_id);

  return (
    <div className={styles.aba}>
      <div className={styles.legenda} aria-hidden="true">
        <span className={styles.lgConcluida}>Concluída</span>
        <span className={styles.lgLiberada}>Liberada</span>
        <span className={styles.lgAtrasada}>Atrasada</span>
        <span className={styles.lgPlanejada}>Planejada</span>
      </div>

      {obra.fases.map((f) => {
        const atvs = topo.filter((a) => a.fase_id === f.id);
        if (atvs.length === 0) return null;
        return (
          <Card key={f.id}>
            <p className={styles.faseTitulo}>{f.titulo}</p>
            <div className={styles.rows}>
              {atvs.map((a) => {
                const c = obra.cron.porId[a.id];
                const e = obra.estados[a.id];
                const estado = e?.concluida
                  ? 'concluida'
                  : e?.atrasada
                    ? 'atrasada'
                    : e?.liberada
                      ? 'liberada'
                      : 'planejada';
                const left = c ? (c.es / total) * 100 : 0;
                const width = c ? Math.max((c.dur / total) * 100, 2) : 2;
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={styles.row}
                    onClick={() => onAbrir(a.id)}
                  >
                    <span className={styles.nome}>{a.nome}</span>
                    <span className={styles.trilho}>
                      <span className={styles.hoje} style={{ left: `${hojePct}%` }} />
                      <span
                        className={`${styles.barra} ${styles[estado]}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
