import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import {
  loadModeloCompleto,
  salvarAtividade,
  sugestoesAtividade,
  type NovaAtividade,
} from './detalhe';

export function useModeloCompleto(id: string | null) {
  return useQuery({
    queryKey: ['modelo', id],
    enabled: Boolean(supabase) && Boolean(id),
    queryFn: () => loadModeloCompleto(id as string),
  });
}

export function useSugestoesAtividade() {
  return useQuery({
    queryKey: ['sugestoes-atividade'],
    enabled: Boolean(supabase),
    queryFn: sugestoesAtividade,
  });
}

export function useSalvarAtividade(modeloId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: NovaAtividade) => salvarAtividade(a),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modelo', modeloId] });
      qc.invalidateQueries({ queryKey: ['modelos'] });
    },
  });
}
