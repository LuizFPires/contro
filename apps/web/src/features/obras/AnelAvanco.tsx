import { Icon } from '@contro/ui';
import styles from './AnelAvanco.module.css';

const R = 16;
const CIRC = 2 * Math.PI * R;

/**
 * Anel de avanço da atividade na trilha (opção C do protótipo): cada toque soma
 * 25%, o quarto conclui. Concluída mostra o check e não reage ao toque. Atrasada
 * usa o vermelho de atraso. O % vai em texto dentro do anel (nunca só cor).
 */
export function AnelAvanco({
  pct,
  atrasada,
  nome,
  onTocar,
}: {
  pct: number;
  atrasada: boolean;
  nome: string;
  onTocar: () => void;
}) {
  if (pct >= 100) {
    return (
      <span className={`${styles.anel} ${styles.concluida}`} aria-label={`${nome}: concluída`}>
        <Icon name="checkGrosso" size={16} strokeWidth={2.6} />
      </span>
    );
  }
  const proximo = pct >= 75 ? 'concluir' : `${Math.min(100, Math.floor(pct / 25) * 25 + 25)}%`;
  return (
    <button
      type="button"
      className={`${styles.anel} ${atrasada ? styles.atrasada : ''}`}
      aria-label={`${nome}: ${pct}% feito. Tocar para ${proximo}`}
      onClick={onTocar}
    >
      <svg width="40" height="40" viewBox="0 0 44 44" aria-hidden="true" className={styles.svg}>
        <circle cx="22" cy="22" r={R} className={styles.trilho} />
        {pct > 0 ? (
          <circle
            cx="22"
            cy="22"
            r={R}
            className={styles.arco}
            strokeDasharray={`${(CIRC * pct) / 100} ${CIRC}`}
            transform="rotate(-90 22 22)"
          />
        ) : null}
      </svg>
      {pct > 0 ? <span className={styles.num}>{pct}</span> : null}
    </button>
  );
}
