import { BottomSheet, Icon } from '@contro/ui';
import styles from './ObraGeralDetalhe.module.css';

export interface ObraDoSeletor {
  id: string;
  nome: string;
}

/** Troca de obra: uma linha por obra geral da pessoa, com o papel dela; a atual vem marcada. */
export function TrocarObraSheet({
  aberto,
  obras,
  atualId,
  papel,
  onEscolher,
  onFechar,
}: {
  aberto: boolean;
  obras: ObraDoSeletor[];
  atualId: string;
  /** "Coordenador", "Membro" ou "Administrador". */
  papel: string;
  onEscolher: (id: string) => void;
  onFechar: () => void;
}) {
  return (
    <BottomSheet open={aberto} title="Suas obras" onClose={onFechar}>
      <ul className={styles.obras}>
        {obras.map((o) => {
          const atual = o.id === atualId;
          return (
            <li key={o.id}>
              <button
                type="button"
                className={`${styles.obraLinha} ${atual ? styles.obraAtual : ''}`}
                aria-current={atual ? 'true' : undefined}
                onClick={() => (atual ? onFechar() : onEscolher(o.id))}
              >
                <span className={styles.obraTexto}>
                  <span className={styles.obraNome}>{o.nome}</span>
                  <span className={styles.obraPapel}>{papel}</span>
                </span>
                {atual ? <Icon name="checkGrosso" size={20} strokeWidth={2.6} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
