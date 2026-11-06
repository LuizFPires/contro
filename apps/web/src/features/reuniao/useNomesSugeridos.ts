import { useQuery } from '@tanstack/react-query';
import type { Ambiente } from '@contro/core';
import { supabase } from '../../lib/supabase';

/**
 * Nomes digitados antes (sugestão tipo pessoa), dos mais usados para os menos.
 * Cada ambiente tem a sua lista: quem tem os dois não vê as listas misturadas.
 */
export function useNomesSugeridos(ambiente: Ambiente = 'contorno') {
  return useQuery<string[]>({
    queryKey: ['sugestao', 'pessoa', ambiente],
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) return [];
      const { data } = await supabase
        .from('sugestao')
        .select('texto')
        .eq('tipo', 'pessoa')
        .eq('ambiente', ambiente)
        .order('usos', { ascending: false })
        .limit(50);
      return ((data ?? []) as { texto: string }[]).map((x) => x.texto);
    },
  });
}
