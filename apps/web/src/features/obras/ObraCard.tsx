import { ritmoTexto } from '@obdc/core';
import { Card } from '@obdc/ui';
import { formatarDataCurta } from '../../lib/datas';
import type { ObraResumo } from './api';
import styles from './ObraCard.module.css';

export function ObraCard({
  obra,
  onAbrir,
  onAbrirTarefas,
}: {
  obra: ObraResumo;
  onAbrir: () => void;
  onAbrirTarefas?: () => void;
}) {
  const ritmo = ritmoTexto(obra.ritmoDias, true);

  return (
    <Card onClick={onAbrir}>
      <div className={styles.card}>
        <div className={styles.topo}>
          <h2 className={styles.nome}>{obra.nome}</h2>
          <span className={styles.pct}>{Math.round(obra.pct * 100)}%</span>
        </div>
        <p className={styles.rotulo}>{obra.modelo_rotulo}</p>

        <div className={styles.linhaFase}>
          <span className={styles.fase}>{obra.faseAtual ?? 'Concluída'}</span>
        </div>
        <div className={styles.segs} aria-hidden="true">
          {obra.fasesEstado.map((e, i) => (
            <span key={i} className={`${styles.seg} ${styles[e] ?? ''}`} />
          ))}
        </div>

        <div className={styles.rodape}>
          <span className={ritmo.atrasada ? styles.atrasada : styles.ritmo}>{ritmo.texto}</span>
          <span className={styles.entrega}>Entrega {formatarDataCurta(obra.entrega)}</span>
        </div>

        {onAbrirTarefas && (obra.tarefasAbertas > 0 || obra.tarefasAtrasadas > 0) ? (
          <button
            type="button"
            className={styles.tarefas}
            onClick={(e) => {
              e.stopPropagation();
              onAbrirTarefas();
            }}
          >
            {obra.tarefasAbertas} {obra.tarefasAbertas === 1 ? 'tarefa' : 'tarefas'}
            {obra.tarefasAtrasadas > 0 ? (
              <span className={styles.tarefasAtraso}>
                {' '}
                · {obra.tarefasAtrasadas} atrasada{obra.tarefasAtrasadas === 1 ? '' : 's'}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
    </Card>
  );
}
