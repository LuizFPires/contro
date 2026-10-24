import { Icon, Monograma, useToast } from '@obdc/ui';
import styles from './MinhasObras.module.css';

export function MinhasObras() {
  const { showToast } = useToast();

  return (
    <div className={styles.screen}>
      <div className={styles.topo}>
        <h1 className={styles.titulo}>Minhas obras</h1>
        <button
          type="button"
          className={styles.nova}
          aria-label="Nova obra"
          onClick={() => showToast({ message: 'Nova obra chega no M2.' })}
        >
          <Icon name="plus" size={24} />
        </button>
      </div>

      <div className={styles.vazio}>
        <Monograma size={56} />
        <h2>Nenhuma obra ainda</h2>
        <p>Quando você criar a primeira obra, ela aparece aqui com fase, progresso e prazo.</p>
      </div>
    </div>
  );
}
