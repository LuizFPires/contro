import { PASSOS_AVANCO } from '@contro/core';
import { Icon } from '@contro/ui';
import styles from './RodapeAvanco.module.css';

interface Props {
  avancoPct: number;
  desabilitado: boolean;
  onPasso(pct: 25 | 50 | 75): void;
  onPronta(): void;
  onFoto(): void;
}

/**
 * Rodapé de avanço (protótipo, opção D): 25 · 50 · 75 · Pronta (vai e volta; o passo
 * marcado volta um) e a Foto ao lado do Pronta, para concluir com foto.
 */
export function RodapeAvanco({ avancoPct, desabilitado, onPasso, onPronta, onFoto }: Props) {
  return (
    <div
      className={`${styles.rodapeConcluir} ${styles.rodapeAvanco}`}
      role="group"
      aria-label="Avanço da atividade"
    >
      {PASSOS_AVANCO.map((v) => {
        const marcado = v <= avancoPct;
        return (
          <button
            key={v}
            type="button"
            className={`${styles.passo} ${marcado ? styles.passoOn : ''} ${
              v === avancoPct ? styles.passoAtual : ''
            }`}
            aria-pressed={marcado}
            disabled={desabilitado}
            onClick={() => (v === 100 ? onPronta() : onPasso(v))}
          >
            {marcado ? <Icon name="checkGrosso" size={14} strokeWidth={3} /> : null}
            {v === 100 ? 'Pronta' : `${v}%`}
          </button>
        );
      })}
      <button
        type="button"
        className={styles.passoFoto}
        aria-label="Concluir com foto"
        disabled={desabilitado}
        onClick={onFoto}
      >
        <Icon name="camera" size={20} strokeWidth={2} />
        Foto
      </button>
    </div>
  );
}
