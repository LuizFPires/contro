import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { listarObrasGerais } from './api';

export function useObrasGerais() {
  return useQuery({
    queryKey: ['obras-gerais'],
    enabled: Boolean(supabase),
    queryFn: listarObrasGerais,
  });
}
