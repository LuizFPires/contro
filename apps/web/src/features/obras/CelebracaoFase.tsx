import { Icon } from '@obdc/ui';
import styles from './CelebracaoFase.module.css';

export interface CelebracaoFaseDados {
  ordem: number;
  titulo: string;
  xp: number;
  libera: string[];
  proxOrdem: number | null;
}

/** Celebração ao fechar uma fase (SPEC/gamificação M9). Substitui o toast simples. */
export function CelebracaoFase({
  dados,
  onFechar,
}: {
  dados: CelebracaoFaseDados;
  onFechar: () => void;
}) {
  return (
    <div className={styles.overlay} role="dialog" aria-label="Fase concluída" aria-modal="true">
      <div className={styles.pop}>
        <div className={styles.ring}>
          <Icon name="check" size={34} />
        </div>
        <p className={styles.kick}>Fase {dados.ordem} concluída</p>
        <p className={styles.titulo}>{dados.titulo}</p>
        <span className={styles.pill}>+{dados.xp} XP para a equipe</span>

        {dados.libera.length > 0 ? (
          <div className={styles.lib}>
            <p className={styles.libTitulo}>Liberado agora</p>
            {dados.libera.map((n) => (
              <p key={n} className={styles.libItem}>
                {n}
              </p>
            ))}
          </div>
        ) : null}

        <button type="button" className={styles.cta} onClick={onFechar}>
          {dados.proxOrdem ? `Ir para a Fase ${dados.proxOrdem}` : 'Voltar à obra'}
        </button>
      </div>
    </div>
  );
}
