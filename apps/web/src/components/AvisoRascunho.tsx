import { Icon } from '@contro/ui';
import styles from './AvisoRascunho.module.css';

/** "Rascunho recuperado" no topo de um formulário, com Descartar. */
export function AvisoRascunho({ onDescartar }: { onDescartar: () => void }) {
  return (
    <div className={styles.aviso} role="status">
      <Icon name="documento" size={16} strokeWidth={2} />
      <span className={styles.texto}>Rascunho recuperado deste aparelho</span>
      <button type="button" className={styles.descartar} onClick={onDescartar}>
        Descartar
      </button>
    </div>
  );
}
