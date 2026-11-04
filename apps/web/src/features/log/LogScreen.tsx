import { Icon } from '@contro/ui';
import { NavInferior, type ItemNav } from '../../screens/NavInferior';
import type { AbrirObra } from '../../screens/MinhasObras';
import styles from './LogScreen.module.css';

/** Log: o que mudou e quem mudou, em todas as obras (ou filtrado por uma). */
export function LogScreen({
  onVoltar,
  onNav,
}: {
  obraInicial?: string | null;
  onVoltar?: () => void;
  onNav: (item: ItemNav) => void;
  onAbrirObra: (o: AbrirObra) => void;
}) {
  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.topo}>
          {onVoltar ? (
            <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
              <Icon name="chevronLeft" size={22} />
            </button>
          ) : null}
          <div className={styles.topoTexto}>
            <h1 className={styles.titulo}>Log</h1>
            <div className={styles.sub}>o que mudou e quem mudou</div>
          </div>
        </div>
      </header>
      <NavInferior ativo="log" onEscolher={onNav} />
    </div>
  );
}
