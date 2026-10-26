import { useState } from 'react';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { useDisparosPendentes } from './useDisparosPendentes';
import styles from './ProntosParaEnviar.module.css';

const EDICAO: Record<string, string> = {
  principal: 'Boletim da semana',
  fechamento: 'Fechamento da semana',
};

/**
 * Boletins "prontos para enviar" (só gestor): ícone no cabeçalho do início com o
 * número de pendentes; o toque abre a gaveta com um cartão por obra.
 */
export function ProntosParaEnviar({
  onAbrirBoletim,
}: {
  onAbrirBoletim: (obraId: string) => void;
}) {
  const { query, marcarEnviado, desfazerEnviado } = useDisparosPendentes();
  const { showToast } = useToast();
  const [aberto, setAberto] = useState(false);
  const itens = query.data ?? [];
  const n = itens.length;

  async function enviar(id: string) {
    await marcarEnviado(id);
    showToast({
      message: 'Marcado como enviado',
      onUndo: () => void desfazerEnviado(id),
    });
  }

  return (
    <>
      <button
        type="button"
        className={styles.icone}
        aria-label={n ? `Boletins prontos para enviar: ${n}` : 'Boletins prontos para enviar'}
        onClick={() => setAberto(true)}
      >
        <Icon name="documento" size={22} />
        {n ? (
          <span className={styles.numero} aria-hidden="true">
            {n}
          </span>
        ) : null}
      </button>

      <BottomSheet open={aberto} onClose={() => setAberto(false)}>
        <div className={styles.gaveta}>
          <div className={styles.topo}>
            <div>
              <h2 className={styles.titulo}>Boletins prontos</h2>
              <div className={styles.explica}>
                Abra, confira e mande no grupo da obra. Depois marque como enviado.
              </div>
            </div>
            <button
              type="button"
              className={styles.fechar}
              aria-label="Fechar"
              onClick={() => setAberto(false)}
            >
              <Icon name="close" size={22} />
            </button>
          </div>

          {itens.map((d) => (
            <div key={d.id} className={styles.cartao}>
              <div className={styles.cartaoTopo}>
                <span className={styles.cartaoIcone} aria-hidden="true">
                  <Icon name="documento" size={20} />
                </span>
                <div className={styles.cartaoTexto}>
                  <div className={styles.obra}>{d.obraNome}</div>
                  <div className={styles.meta}>
                    {EDICAO[d.edicao]} · semana de {formatarDataCurta(d.semanaInicio)}
                  </div>
                </div>
              </div>
              <div className={styles.acoes}>
                <button
                  type="button"
                  className={styles.abrir}
                  onClick={() => {
                    setAberto(false);
                    onAbrirBoletim(d.obraId);
                  }}
                >
                  Abrir boletim
                </button>
                <button type="button" className={styles.enviado} onClick={() => void enviar(d.id)}>
                  <Icon name="checkGrosso" size={16} strokeWidth={2.6} />
                  Enviado
                </button>
              </div>
            </div>
          ))}

          {n === 0 ? (
            <div className={styles.vazio}>
              Nenhum boletim esperando envio. Os próximos aparecem aqui no dia e hora do boletim
              automático.
            </div>
          ) : null}
        </div>
      </BottomSheet>
    </>
  );
}
