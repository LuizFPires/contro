import { useQuery } from '@tanstack/react-query';
import type { Perfil } from '@contro/core';
import { supabase } from '../../lib/supabase';

export interface PessoaAtual {
  id: string;
  perfil: Perfil;
  nome: string;
  /** false = cadastro pendente de aprovação do gestor. */
  ativo: boolean;
}

/** Perfil/nome da pessoa logada. ativo=false → aguardando aprovação do gestor. */
export function usePerfil() {
  return useQuery<PessoaAtual | null>({
    queryKey: ['perfil'],
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) return null;
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data } = await supabase
        .from('pessoa')
        .select('id, perfil, nome, ativo')
        .eq('user_id', user.id)
        .maybeSingle();
      return (data as PessoaAtual | null) ?? null;
    },
  });
}
