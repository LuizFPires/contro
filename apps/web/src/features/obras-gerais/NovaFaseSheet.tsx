import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet, Button, Input } from '@contro/ui';
import { adicionarFaseGeral } from './planejamento';

/** Nova fase: só o nome. Entra no fim da trilha, antes da entrega da obra. */
export function NovaFaseSheet({
  aberto,
  obraId,
  onFechar,
  onCriada,
}: {
  aberto: boolean;
  obraId: string;
  onFechar: () => void;
  /** Recebe o id da fase criada (a trilha abre ela). */
  onCriada: (faseId: string) => void;
}) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setTitulo('');
      setCriando(false);
      setErro('');
    }
  }, [aberto]);

  const limpo = titulo.trim().replace(/\s+/g, ' ');

  async function criar() {
    if (!limpo || criando) return;
    setCriando(true);
    setErro('');
    try {
      const id = await adicionarFaseGeral(obraId, limpo);
      await qc.invalidateQueries({ queryKey: ['obra', obraId] });
      onCriada(id);
      onFechar();
    } catch (e) {
      setCriando(false);
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a fase.');
    }
  }

  return (
    <BottomSheet open={aberto} title="Nova fase" onClose={onFechar}>
      <Input
        label="Nome da fase"
        value={titulo}
        autoFocus
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void criar();
        }}
      />
      {erro ? (
        <p role="alert" style={{ margin: '12px 0 0', fontSize: 14, fontWeight: 700 }}>
          {erro}
        </p>
      ) : null}
      <div style={{ marginTop: 16 }}>
        <Button onClick={() => void criar()} disabled={!limpo || criando}>
          Criar fase
        </Button>
      </div>
    </BottomSheet>
  );
}
