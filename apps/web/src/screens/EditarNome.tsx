import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { temNomeESobrenome } from '@contro/core';
import { BottomSheet, Button, Input, useToast } from '@contro/ui';
import { supabase } from '../lib/supabase';

/** "Editar meu nome": nome e sobrenome; nas etiquetas aparece o nome curto (Luiz F). */
export function EditarNome({
  aberto,
  atual,
  onFechar,
}: {
  aberto: boolean;
  atual: string;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [nome, setNome] = useState(atual);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setNome(atual);
      setErro('');
    }
  }, [aberto, atual]);

  async function salvar() {
    if (!temNomeESobrenome(nome)) {
      setErro('Informe nome e sobrenome.');
      return;
    }
    if (!supabase) return;
    setSalvando(true);
    const { error } = await supabase.rpc('atualizar_meu_nome', { p_nome: nome });
    setSalvando(false);
    if (error) {
      setErro('Não foi possível salvar. Tente de novo.');
      return;
    }
    void qc.invalidateQueries({ queryKey: ['perfil'] });
    void qc.invalidateQueries({ queryKey: ['pessoas'] });
    void qc.invalidateQueries({ queryKey: ['obras'] });
    showToast({ message: 'Nome atualizado' });
    onFechar();
  }

  return (
    <BottomSheet open={aberto} title="Editar meu nome" onClose={onFechar}>
      <Input
        label="Nome e sobrenome"
        value={nome}
        autoComplete="name"
        onChange={(e) => setNome(e.target.value)}
        error={erro || undefined}
      />
      <p style={{ fontSize: 13, color: '#464646', margin: '8px 0 16px' }}>
        Nas etiquetas aparece o primeiro nome com a inicial do sobrenome (ex.: Luiz F).
      </p>
      <Button full disabled={salvando} onClick={salvar}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </Button>
    </BottomSheet>
  );
}
