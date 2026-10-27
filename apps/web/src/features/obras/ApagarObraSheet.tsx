import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet, Button, useToast } from '@contro/ui';
import { excluirObra, restaurarObra } from './campo';

/**
 * Apagar obra (só o gestor): sempre pede confirmação. Exclusão lógica no banco;
 * logo depois, o toast tem Desfazer.
 */
export function ApagarObraSheet({
  obra,
  aberto,
  onFechar,
  onApagada,
}: {
  obra: { id: string; nome: string };
  aberto: boolean;
  onFechar: () => void;
  /** Volta para a lista depois de apagar. */
  onApagada: () => void;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState('');

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ['obras'] });
    void qc.invalidateQueries({ queryKey: ['obra', obra.id] });
  };

  async function apagar() {
    setApagando(true);
    setErro('');
    try {
      await excluirObra(obra.id);
    } catch {
      setApagando(false);
      setErro('Não foi possível apagar a obra. Confira a conexão e tente de novo.');
      return;
    }
    setApagando(false);
    atualizar();
    onFechar();
    onApagada();
    showToast({
      message: `Obra "${obra.nome}" apagada`,
      onUndo: () => void restaurarObra(obra.id).then(atualizar),
    });
  }

  return (
    <BottomSheet open={aberto} title="Apagar esta obra?" onClose={onFechar}>
      <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>{obra.nome}</p>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#464646' }}>
        A obra sai de Minhas obras, do Hoje, da reunião e do boletim, para todo mundo. Dá para
        desfazer logo depois, no aviso que aparece.
      </p>
      {erro ? (
        <p role="alert" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
          {erro}
        </p>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Button variant="tertiary" disabled={apagando} onClick={onFechar}>
          Cancelar
        </Button>
        <Button variant="secondary" disabled={apagando} onClick={apagar}>
          {apagando ? 'Apagando…' : 'Apagar obra'}
        </Button>
      </div>
    </BottomSheet>
  );
}
