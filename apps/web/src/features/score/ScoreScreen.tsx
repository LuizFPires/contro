import { NavInferior, type ItemNav } from '../../screens/NavInferior';
import styles from '../log/LogScreen.module.css';

/** Score: como cada um entrega (equipe e prestadores), por nome. */
export function ScoreScreen({ onNav }: { onNav: (item: ItemNav) => void }) {
  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.topo}>
          <div className={styles.topoTexto}>
            <h1 className={styles.titulo}>Score</h1>
            <div className={styles.sub}>como cada um entrega</div>
          </div>
        </div>
      </header>
      <NavInferior ativo="score" onEscolher={onNav} />
    </div>
  );
}
