import { useQuery } from '@tanstack/react-query';
import { Icon } from '@contro/ui';
import { formatarDataCompleta } from '../../lib/datas';
import { dataLocal } from './api';
import { listarObrasConcluidas } from './obrasConcluidasApi';
import styles from './ObrasConcluidas.module.css';

/**
 * Obras concluídas (pedido do Matheus, 28/11/2026): fora de Minhas obras, do
 * Hoje, das ações, dos avisos, da reunião e do boletim. Consulta pelo menu do
 * perfil; tocar abre a obra (com Reabrir para Gestor e Coordenador).
 */
export function ObrasConcluidas({
  onVoltar,
  onAbrir,
}: {
  onVoltar: () => void;
  onAbrir: (obraId: string) => void;
}) {
  const q = useQuery({ queryKey: ['obras-concluidas'], queryFn: listarObrasConcluidas });
  const lista = q.data ?? [];
  return (
    <div className={styles.screen}>
      <div className={styles.barra}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronLeft" size={22} />
        </button>
        <h1 className={styles.titulo}>Obras concluídas</h1>
      </div>
      {q.isLoading ? (
        <p className={styles.vazio}>Carregando…</p>
      ) : q.isError ? (
        <p className={styles.vazio} role="alert">
          Não foi possível carregar as obras concluídas.
        </p>
      ) : lista.length === 0 ? (
        <p className={styles.vazio}>
          Nenhuma obra concluída ainda. Para concluir, use o menu ⋮ da obra.
        </p>
      ) : (
        <ul className={styles.lista}>
          {lista.map((o) => (
            <li key={o.id}>
              <button type="button" className={styles.item} onClick={() => onAbrir(o.id)}>
                <span className={styles.icone} aria-hidden="true">
                  <Icon name="bandeira" size={18} strokeWidth={2.2} />
                </span>
                <span className={styles.texto}>
                  <b>{o.nome}</b>
                  <span>
                    Concluída
                    {o.concluida_em ? ` ${formatarDataCompleta(dataLocal(o.concluida_em))}` : ''}
                    {o.concluida_por_nome ? ` · ${o.concluida_por_nome}` : ''}
                  </span>
                </span>
                <Icon name="chevronRight" size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
