import { Card } from '@obdc/ui';
import { formatarDataCurta } from '../../lib/datas';
import type { ObraResumo } from './api';
import styles from './ObraCard.module.css';

export function ObraCard({ obra, onAbrir }: { obra: ObraResumo; onAbrir: () => void }) {
  const ritmoTexto =
    obra.ritmoDias >= 1
      ? `${obra.ritmoDias} dias à frente`
      : obra.ritmoDias <= -2
        ? `Atrasada · ${Math.abs(obra.ritmoDias)} dias`
        : 'No ritmo';

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
          <span className={obra.atrasada ? styles.atrasada : styles.ritmo}>{ritmoTexto}</span>
          <span className={styles.entrega}>Entrega {formatarDataCurta(obra.entrega)}</span>
        </div>
      </div>
    </Card>
  );
}
