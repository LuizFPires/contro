import { Icon, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { useDisparosPendentes } from './useDisparosPendentes';
import styles from './ProntosParaEnviar.module.css';

const EDICAO: Record<string, string> = {
  principal: 'Boletim da semana',
  fechamento: 'Fechamento da semana',
};

/** Seção "prontos para enviar" (só gestor): boletins no horário, aguardando envio. */
export function ProntosParaEnviar({
  onAbrirBoletim,
}: {
  onAbrirBoletim: (obraId: string) => void;
}) {
  const { query, marcarEnviado, desfazerEnviado } = useDisparosPendentes();
  const { showToast } = useToast();
  const itens = query.data ?? [];

  if (itens.length === 0) return null;

  async function enviar(id: string) {
    await marcarEnviado(id);
    showToast({
      message: 'Marcado como enviado.',
      onUndo: () => void desfazerEnviado(id),
    });
  }

  return (
    <section className={styles.bloco} aria-label="Prontos para enviar">
      <p className={styles.titulo}>
        <Icon name="boletim" size={18} />
        Prontos para enviar · {itens.length}
      </p>
      <ul className={styles.lista}>
        {itens.map((d) => (
          <li key={d.id} className={styles.item}>
            <div className={styles.info}>
              <strong className={styles.obra}>{d.obraNome}</strong>
              <span className={styles.meta}>
                {EDICAO[d.edicao]} · semana de {formatarDataCurta(d.semanaInicio)}
              </span>
            </div>
            <div className={styles.acoes}>
              <button
                type="button"
                className={styles.abrir}
                onClick={() => onAbrirBoletim(d.obraId)}
              >
                Abrir
              </button>
              <button type="button" className={styles.enviado} onClick={() => void enviar(d.id)}>
                <Icon name="check" size={16} />
                Enviado
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
