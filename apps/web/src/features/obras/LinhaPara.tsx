import type { ReactNode } from 'react';
import { Icon } from '@contro/ui';
import styles from './LinhaPara.module.css';

/**
 * Item do "Para começar" (opção A do protótipo): linha de altura fixa com o
 * quadrado de feito à esquerda (toque marca ou desmarca), tipo, nome em uma
 * linha, uma linha de datas e o "⋯" com o detalhe (editar, excluir).
 */
export function LinhaPara({
  tipo,
  nome,
  meta,
  feito,
  atrasado,
  pendente,
  onAlternar,
  onMais,
}: {
  tipo: string;
  nome: string;
  meta: ReactNode;
  feito: boolean;
  atrasado: boolean;
  pendente?: boolean;
  onAlternar: () => void;
  /** Sem "⋯" (ex.: mapa de coleta): fica o espaço, para alinhar. */
  onMais?: () => void;
}) {
  return (
    <div className={`${styles.linha} ${atrasado ? styles.atraso : ''}`}>
      <button
        type="button"
        className={styles.check}
        aria-pressed={feito}
        aria-label={feito ? `Desmarcar ${nome}` : `Marcar ${nome} como feito`}
        disabled={pendente}
        onClick={onAlternar}
      >
        <span className={feito ? styles.caixaOn : styles.caixa}>
          {feito ? <Icon name="checkGrosso" size={18} strokeWidth={3} /> : null}
        </span>
      </button>
      <div className={styles.texto}>
        <span className={styles.tipo}>{tipo}</span>
        <span className={`${styles.nome} ${feito ? styles.nomeFeito : ''}`}>{nome}</span>
        <span className={atrasado ? styles.metaAtraso : styles.meta}>
          {atrasado ? <Icon name="relogio" size={13} strokeWidth={2.4} /> : null}
          {meta}
        </span>
      </div>
      {onMais ? (
        <button
          type="button"
          className={styles.mais}
          aria-label={`Mais opções de ${nome}`}
          onClick={onMais}
        >
          <Icon name="more" size={20} />
        </button>
      ) : (
        <span className={styles.mais} aria-hidden="true" />
      )}
    </div>
  );
}
