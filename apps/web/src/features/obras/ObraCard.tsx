import { ritmoTexto } from '@contro/core';
import { Icon } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import type { ObraResumo } from './api';
import styles from './ObraCard.module.css';

export function ObraCard({
  obra,
  onAbrir,
  onAbrirPlano,
}: {
  obra: ObraResumo;
  onAbrir: () => void;
  /** Toque na faixa "Inauguração em risco": abre o plano de recuperação. */
  onAbrirPlano: () => void;
}) {
  const ritmo = ritmoTexto(obra.ritmoDias, true);
  const n = obra.atividadesAtrasadas;
  const faseTxt =
    obra.faseAtualN && obra.faseAtual
      ? `Em execução · Fase ${obra.faseAtualN} de ${obra.nFases} · ${obra.faseAtual}`
      : 'Concluída';

  return (
    <div className={`${styles.card} ${n > 0 ? styles.comAtraso : ''}`}>
      <button type="button" className={styles.corpo} onClick={onAbrir}>
        <span className={styles.topo}>
          <span className={styles.titulos}>
            <span className={styles.nome}>{obra.nome}</span>
            <span className={styles.fase}>{faseTxt}</span>
          </span>
          <span className={styles.pct}>
            {Math.round(obra.pct * 100)}
            <span>%</span>
          </span>
        </span>

        <span
          className={styles.segs}
          style={{ gridTemplateColumns: `repeat(${obra.fasesEstado.length || 1}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          {obra.fasesEstado.map((e, i) => (
            <span key={i} className={`${styles.seg} ${styles[e] ?? ''}`} />
          ))}
        </span>

        <span className={styles.rodape}>
          <span className={ritmo.atrasada ? styles.ritmoAtraso : styles.ritmo}>{ritmo.texto}</span>
          <span className={styles.entrega}>
            Entrega {formatarDataCurta(obra.entregaPrevista)}
            {obra.inauguracao ? (
              <>
                <br />
                Inauguração {formatarDataCurta(obra.inauguracao)}
              </>
            ) : null}
          </span>
        </span>

        {n > 0 ? (
          <span className={styles.alertaAtraso}>
            <Icon name="alert" size={16} strokeWidth={2.2} />
            {n} {n === 1 ? 'atividade atrasada' : 'atividades atrasadas'}
          </span>
        ) : null}
      </button>

      {obra.risco ? (
        <button type="button" className={styles.risco} onClick={onAbrirPlano}>
          <Icon name="relogio" size={20} strokeWidth={2.2} className={styles.riscoIcone} />
          <span className={styles.riscoTexto}>
            <b className={styles.riscoTitulo}>Inauguração em risco · +{obra.risco.atrasoDu} d.u.</b>
            <span>
              <s>{formatarDataCurta(obra.risco.original)}</s> →{' '}
              <b>{formatarDataCurta(obra.risco.prevista)}</b>
            </span>
          </span>
          <span className={styles.riscoLink}>
            Ver plano
            <Icon name="chevronRight" size={16} strokeWidth={2.2} />
          </span>
        </button>
      ) : null}
    </div>
  );
}
