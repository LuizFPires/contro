import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { carregarObraGeral } from './obraGeral';

/** Mesma chave da obra Contorno: a fila de campo invalida `['obra', id]` nos dois ambientes. */
export function useObraGeral(id: string | null) {
  return useQuery({
    queryKey: ['obra', id],
    enabled: Boolean(supabase) && Boolean(id),
    queryFn: () => carregarObraGeral(id as string),
  });
}
