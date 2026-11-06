import { textoAcoesBloco, type Acao } from '@contro/core';
import { Icon } from '@contro/ui';
import { hojeISO } from '../obras/api';
import styles from './BlocoAcoesGeral.module.css';

/**
 * Bloco "Ações da equipe" (mockups C1, J2, A13): quantas atividades abertas e quantas
 * atrasadas (ou vencem hoje, para o Membro). Toque abre a tela de ações.
 */
export function BlocoAcoesGeral({
  acoes,
  pessoaId,
  soDaPessoa,
  onAbrir,
}: {
  acoes: Acao[];
  pessoaId: string | null;
  soDaPessoa: boolean;
  onAbrir: () => void;
}) {
  const t = textoAcoesBloco(acoes, hojeISO(), pessoaId, soDaPessoa);
  const vencemHoje = t.detalhe !== null && t.atrasadas === 0;
  return (
    <button type="button" className={styles.bloco} onClick={onAbrir}>
      <span className={styles.titulo}>
        <Icon name="tarefas" size={18} strokeWidth={2} />
        Ações da equipe
      </span>
      <span className={styles.principal}>{t.principal}</span>
      {t.detalhe ? (
        <span className={vencemHoje ? styles.hoje : styles.atraso}>
          <Icon name={vencemHoje ? 'atencao' : 'alert'} size={13} strokeWidth={2.4} />
          {t.detalhe}
        </span>
      ) : null}
    </button>
  );
}
