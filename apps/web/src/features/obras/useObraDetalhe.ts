import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { loadObra } from './detalhe';

export function useObraDetalhe(id: string | null) {
  return useQuery({
    queryKey: ['obra', id],
    enabled: Boolean(supabase) && Boolean(id),
    queryFn: () => loadObra(id as string),
  });
}
