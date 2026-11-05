import type { ObraGeral } from './api';
import styles from './PessoasAcessos.module.css';

/** Uma chave por obra geral. */
export function ChavesObras({
  obras,
  marcadas,
  onAlternar,
}: {
  obras: ObraGeral[];
  marcadas: string[];
  onAlternar: (obraId: string) => void;
}) {
  if (obras.length === 0) return <p className={styles.nota}>Ainda não há obras gerais.</p>;
  return (
    <div>
      {obras.map((o) => {
        const ligada = marcadas.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            role="switch"
            aria-checked={ligada}
            className={styles.switch}
            onClick={() => onAlternar(o.id)}
          >
            <span className={styles.switchLabel}>{o.nome}</span>
            <span className={styles.direita}>
              <span className={styles.estado}>{ligada ? 'Com acesso' : 'Sem acesso'}</span>
              <span className={`${styles.track} ${ligada ? styles.trackOn : ''}`}>
                <span className={styles.knob} />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
