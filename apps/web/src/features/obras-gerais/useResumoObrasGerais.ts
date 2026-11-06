import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { hojeISO } from '../obras/api';
import { usePerfil } from '../perfil/usePerfil';
import { carregarResumoObrasGerais } from './resumoObrasGerais';

/** Resumo das obras gerais para o Hoje e as ações; invalidado junto com `['obra', id]`. */
export function useResumoObrasGerais() {
  const { data: pessoa } = usePerfil();
  return useQuery({
    queryKey: ['obras-gerais', 'resumo'],
    enabled: Boolean(supabase) && Boolean(pessoa),
    queryFn: () => carregarResumoObrasGerais(pessoa!, hojeISO()),
  });
}
