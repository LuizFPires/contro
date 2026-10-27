import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet, Button, Input, useToast } from '@contro/ui';
import { renomearObra } from './campo';
import type { ObraCompleta } from './detalhe';

/** "Editar nome da obra" (menu ⋮ do cabeçalho), com Desfazer. */
export function RenomearObraSheet({
  obra,
  aberto,
  onFechar,
}: {
  obra: { id: string; nome: string };
  aberto: boolean;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [nome, setNome] = useState(obra.nome);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setNome(obra.nome);
      setErro('');
    }
  }, [aberto, obra.nome]);

  // Otimista: troca o nome na tela na hora; volta se o servidor recusar.
  function aplicar(novo: string, antes: string) {
    qc.setQueryData<ObraCompleta>(['obra', obra.id], (o) => (o ? { ...o, nome: novo } : o));
    renomearObra(obra.id, novo)
      .catch(() => {
        qc.setQueryData<ObraCompleta>(['obra', obra.id], (o) => (o ? { ...o, nome: antes } : o));
        showToast({ message: 'Não foi possível salvar o nome da obra' });
      })
      .finally(() => void qc.invalidateQueries({ queryKey: ['obras'] }));
  }

  function salvar() {
    const novo = nome.trim().replace(/\s+/g, ' ');
    if (!novo) {
      setErro('Dê um nome à obra.');
      return;
    }
    const antes = obra.nome;
    onFechar();
    if (novo === antes) return;
    aplicar(novo, antes);
    showToast({ message: 'Nome da obra salvo', onUndo: () => aplicar(antes, novo) });
  }

  return (
    <BottomSheet open={aberto} title="Editar nome da obra" onClose={onFechar}>
      <Input
        label="Nome da obra"
        value={nome}
        autoFocus
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') salvar();
        }}
        error={erro || undefined}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
        <Button variant="tertiary" onClick={onFechar}>
          Cancelar
        </Button>
        <Button onClick={salvar}>Salvar</Button>
      </div>
    </BottomSheet>
  );
}
