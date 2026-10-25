import { useQuery } from '@tanstack/react-query';
import type { Perfil } from '@obdc/core';
import { supabase } from '../../lib/supabase';

export interface PessoaAtual {
  perfil: Perfil;
  nome: string;
}

/** Perfil/nome da pessoa logada (para esconder a edição de modelos da equipe). */
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
        .select('perfil, nome')
        .eq('user_id', user.id)
        .maybeSingle();
      return (data as PessoaAtual | null) ?? null;
    },
  });
}
