import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface PessoaResumo {
  id: string;
  nome: string;
  papel_texto: string | null;
}

/** Pessoas ativas (para escolher o responsável de uma tarefa). */
export function usePessoas() {
  return useQuery<PessoaResumo[]>({
    queryKey: ['pessoas'],
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) return [];
      const { data } = await supabase
        .from('pessoa')
        .select('id,nome,papel_texto')
        .eq('ativo', true)
        .is('deleted_at', null)
        .order('nome');
      return (data ?? []) as PessoaResumo[];
    },
  });
}
