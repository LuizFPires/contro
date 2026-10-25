import { Icon, useToast } from '@contro/ui';
import { useMembrosPendentes } from './useMembros';
import styles from './AprovarMembros.module.css';

/** Tela do gestor: aprovar ou recusar cadastros pendentes. */
export function AprovarMembros({ onVoltar }: { onVoltar: () => void }) {
  const { query, aprovar, recusar } = useMembrosPendentes();
  const { showToast } = useToast();
  const itens = query.data ?? [];

  return (
    <div className={styles.screen}>
      <div className={styles.barra}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronRight" size={22} />
        </button>
        <span className={styles.titulo}>Aprovar membros</span>
      </div>

      {query.isLoading ? (
        <p className={styles.vazio}>Carregando…</p>
      ) : itens.length === 0 ? (
        <p className={styles.vazio}>Nenhum cadastro aguardando aprovação.</p>
      ) : (
        <ul className={styles.lista}>
          {itens.map((m) => (
            <li key={m.id} className={styles.item}>
              <span className={styles.nome}>{m.nome}</span>
              <div className={styles.acoes}>
                <button
                  type="button"
                  className={styles.recusar}
                  onClick={() =>
                    recusar.mutate(m.id, {
                      onSuccess: () => showToast({ message: 'Cadastro recusado.' }),
                      onError: (e) => showToast({ message: (e as Error).message }),
                    })
                  }
                >
                  Recusar
                </button>
                <button
                  type="button"
                  className={styles.aprovar}
                  onClick={() =>
                    aprovar.mutate(m.id, {
                      onSuccess: () => showToast({ message: `${m.nome} aprovado.` }),
                      onError: (e) => showToast({ message: (e as Error).message }),
                    })
                  }
                >
                  <Icon name="check" size={16} />
                  Aprovar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
