import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { gerarObra, listarObras, listarUnidades } from './api';

export function useObras() {
  return useQuery({
    queryKey: ['obras'],
    enabled: Boolean(supabase),
    queryFn: listarObras,
  });
}

export function useUnidades() {
  return useQuery({
    queryKey: ['unidades'],
    enabled: Boolean(supabase),
    queryFn: listarUnidades,
  });
}

export function useGerarObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      unidadeId,
      inicio,
      nome,
      modeloId,
    }: {
      unidadeId: string;
      inicio: string;
      nome: string;
      modeloId: string;
    }) => gerarObra(unidadeId, inicio, nome, modeloId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obras'] }),
  });
}

/** Próximas N segundas-feiras (ISO), a partir de hoje. */
export function proximasSegundas(n = 8): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  // avança até a próxima segunda (1)
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}
