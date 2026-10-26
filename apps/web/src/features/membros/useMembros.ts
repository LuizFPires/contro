import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface MembroPendente {
  id: string;
  nome: string;
  criadoEm: string;
}

interface Row {
  id: string;
  nome: string;
  created_at: string;
}

const KEY = ['membros-pendentes'];

/** Cadastros aguardando aprovação do gestor (pessoa ativo=false). */
export function useMembrosPendentes(ativo = true) {
  const qc = useQueryClient();

  const query = useQuery<MembroPendente[]>({
    queryKey: KEY,
    enabled: Boolean(supabase) && ativo,
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('pessoa')
        .select('id, nome, created_at')
        .eq('ativo', false)
        .is('deleted_at', null)
        .order('created_at');
      if (error) throw error;
      return ((data ?? []) as Row[]).map((r) => ({
        id: r.id,
        nome: r.nome,
        criadoEm: r.created_at,
      }));
    },
  });

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Sem conexão');
      const { error } = await supabase.rpc('aprovar_pessoa', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const recusar = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Sem conexão');
      const { error } = await supabase.rpc('recusar_pessoa', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return { query, aprovar, recusar };
}
