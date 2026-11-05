import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet, Button, Input, useToast } from '@contro/ui';
import { excluirObra } from '../obras/campo';
import { criarObraGeral } from './api';

/** Nova obra geral (só Administrador): nome e cidade. Criou, tem Desfazer por 5 s. */
export function NovaObraGeralSheet({
  aberto,
  onFechar,
}: {
  aberto: boolean;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setNome('');
      setCidade('');
      setErro('');
      setCriando(false);
    }
  }, [aberto]);

  const atualizar = () => void qc.invalidateQueries({ queryKey: ['obras-gerais'] });
  const nomeLimpo = nome.trim().replace(/\s+/g, ' ');

  async function criar() {
    if (!nomeLimpo || criando) return;
    setCriando(true);
    setErro('');
    const id = crypto.randomUUID();
    try {
      await criarObraGeral(nomeLimpo, cidade.trim(), id);
    } catch {
      setCriando(false);
      setErro('Não foi possível criar a obra. Confira a conexão e tente de novo.');
      return;
    }
    onFechar();
    atualizar();
    showToast({
      message: 'Obra criada.',
      onUndo: () =>
        void excluirObra(id)
          .then(atualizar)
          .catch(() => {
            atualizar();
            showToast({ message: 'Não foi possível desfazer. Tente de novo.' });
          }),
    });
  }

  return (
    <BottomSheet open={aberto} title="Nova obra" onClose={onFechar}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Input
          label="Nome da obra"
          value={nome}
          autoFocus
          onChange={(e) => setNome(e.target.value)}
        />
        <Input
          label="Cidade"
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void criar();
          }}
        />
      </div>
      {erro ? (
        <p role="alert" style={{ margin: '12px 0 0', fontSize: 14, fontWeight: 700 }}>
          {erro}
        </p>
      ) : null}
      <div style={{ marginTop: 16 }}>
        <Button onClick={() => void criar()} disabled={!nomeLimpo || criando}>
          Criar obra
        </Button>
      </div>
    </BottomSheet>
  );
}
