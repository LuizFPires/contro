import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet, Button, useToast } from '@contro/ui';
import { concluirObra, reabrirObra } from './campo';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Concluir obra (Gestor e Coordenador, pedido do Matheus, 28/11/2026): a obra
 * sai de Minhas obras, do Hoje, das ações, dos avisos, da reunião e do boletim,
 * e fica em "Obras concluídas" (menu do perfil). Não trava por pendência: avisa
 * que as abertas serão dadas como resolvidas neste ato. Desfazer no aviso.
 */
export function ConcluirObraSheet({
  obra,
  pct,
  pendAbertas,
  aberto,
  onFechar,
  onConcluida,
}: {
  obra: { id: string; nome: string };
  /** Avanço da obra, 0 a 100. */
  pct: number;
  pendAbertas: number;
  aberto: boolean;
  onFechar: () => void;
  /** Volta para a lista depois de concluir. */
  onConcluida: () => void;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // A obra some de várias telas (lista, Hoje, ações, reunião, Score): recarrega tudo.
  const atualizar = () => void qc.invalidateQueries();

  async function concluir() {
    setSalvando(true);
    setErro('');
    let resolvidas = 0;
    try {
      resolvidas = await concluirObra(obra.id);
    } catch {
      setSalvando(false);
      setErro('Não foi possível concluir a obra. Confira a conexão e tente de novo.');
      return;
    }
    setSalvando(false);
    atualizar();
    onFechar();
    onConcluida();
    showToast({
      message:
        resolvidas > 0
          ? `Obra concluída · ${plural(resolvidas, 'pendência resolvida', 'pendências resolvidas')}`
          : 'Obra concluída',
      onUndo: () =>
        void reabrirObra(obra.id, true).then(atualizar, () =>
          showToast({ message: 'Não foi possível desfazer' }),
        ),
    });
  }

  return (
    <BottomSheet open={aberto} title="Concluir esta obra?" onClose={onFechar}>
      <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>{obra.nome}</p>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: '#464646' }}>
        A obra fica como Obra concluída: sai de Minhas obras, do Hoje, das ações, dos avisos, da
        reunião e do boletim. Ela continua no Score, no Log e em Obras concluídas, no menu do
        perfil, e pode ser reaberta.
      </p>
      {pct < 100 ? (
        <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
          A obra está em {pct}%. As atividades abertas ficam como estão.
        </p>
      ) : null}
      {pendAbertas > 0 ? (
        <div
          role="alert"
          style={{
            margin: '0 0 16px',
            padding: 12,
            borderRadius: 12,
            border: '2px solid #181818',
            fontSize: 14,
          }}
        >
          <strong>
            {pendAbertas === 1
              ? 'Há 1 pendência aberta no Check list.'
              : `Há ${pendAbertas} pendências abertas no Check list.`}
          </strong>{' '}
          Ao concluir, {pendAbertas === 1 ? 'ela será dada' : 'todas serão dadas'} como{' '}
          {pendAbertas === 1 ? 'resolvida' : 'resolvidas'} e você confirma que{' '}
          {pendAbertas === 1 ? 'foi resolvida' : 'todas foram resolvidas'} neste ato.
        </div>
      ) : (
        <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>
          Nenhuma pendência aberta no Check list.
        </p>
      )}
      {erro ? (
        <p role="alert" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
          {erro}
        </p>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Button variant="tertiary" disabled={salvando} onClick={onFechar}>
          Cancelar
        </Button>
        <Button disabled={salvando} onClick={() => void concluir()}>
          {salvando ? 'Concluindo…' : 'Concluir obra'}
        </Button>
      </div>
    </BottomSheet>
  );
}
