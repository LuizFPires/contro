import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

/** Nomes digitados antes (sugestão tipo pessoa), dos mais usados para os menos. */
export function useNomesSugeridos() {
  return useQuery<string[]>({
    queryKey: ['sugestao', 'pessoa'],
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) return [];
      const { data } = await supabase
        .from('sugestao')
        .select('texto')
        .eq('tipo', 'pessoa')
        .order('usos', { ascending: false })
        .limit(50);
      return ((data ?? []) as { texto: string }[]).map((x) => x.texto);
    },
  });
}
