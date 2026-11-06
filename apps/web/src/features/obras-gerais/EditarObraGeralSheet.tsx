import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet, Button, Input, useToast } from '@contro/ui';
import { editarObraGeral } from './api';

/**
 * Editar nome e cidade da obra geral (Gestor; Coordenador nas dele). Salvou, tem
 * Desfazer por 5 s, que volta o nome e a cidade de antes.
 */
export function EditarObraGeralSheet({
  aberto,
  obra,
  onFechar,
}: {
  aberto: boolean;
  obra: { id: string; nome: string; cidade: string | null };
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [nome, setNome] = useState(obra.nome);
  const [cidade, setCidade] = useState(obra.cidade ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setNome(obra.nome);
      setCidade(obra.cidade ?? '');
      setErro('');
      setSalvando(false);
    }
  }, [aberto, obra.nome, obra.cidade]);

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ['obra', obra.id] });
    void qc.invalidateQueries({ queryKey: ['obras-gerais'] });
  };
  const nomeLimpo = nome.trim().replace(/\s+/g, ' ');
  const cidadeLimpa = cidade.trim().replace(/\s+/g, ' ');
  const mudou = nomeLimpo !== obra.nome || cidadeLimpa !== (obra.cidade ?? '');

  async function salvar() {
    if (!nomeLimpo || salvando) return;
    if (!mudou) {
      onFechar();
      return;
    }
    setSalvando(true);
    setErro('');
    const antes = { nome: obra.nome, cidade: obra.cidade ?? '' };
    try {
      await editarObraGeral(obra.id, nomeLimpo, cidadeLimpa);
    } catch {
      setSalvando(false);
      setErro('Não foi possível salvar. Confira a conexão e tente de novo.');
      return;
    }
    onFechar();
    atualizar();
    showToast({
      message: 'Obra salva.',
      onUndo: () =>
        void editarObraGeral(obra.id, antes.nome, antes.cidade)
          .then(atualizar)
          .catch(() => {
            atualizar();
            showToast({ message: 'Não foi possível desfazer. Tente de novo.' });
          }),
    });
  }

  return (
    <BottomSheet open={aberto} title="Editar obra" onClose={onFechar}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Input
          label="Nome da obra"
          value={nome}
          maxLength={80}
          onChange={(e) => setNome(e.target.value)}
        />
        <Input
          label="Cidade"
          value={cidade}
          maxLength={60}
          onChange={(e) => setCidade(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void salvar();
          }}
        />
      </div>
      {erro ? (
        <p role="alert" style={{ margin: '12px 0 0', fontSize: 14, fontWeight: 700 }}>
          {erro}
        </p>
      ) : null}
      <div style={{ marginTop: 16 }}>
        <Button onClick={() => void salvar()} disabled={!nomeLimpo || salvando}>
          Salvar
        </Button>
      </div>
    </BottomSheet>
  );
}
