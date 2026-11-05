import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Ambiente } from '@contro/core';
import { supabase } from '../../lib/supabase';
import { gerarObra, listarObras, listarUnidades } from './api';

/**
 * Obras ativas do ambiente. As telas da Contorno só existem no ambiente
 * Contorno (o App manda as obras gerais para outra tela), daí o padrão.
 */
export function useObras(ambiente: Ambiente = 'contorno') {
  return useQuery({
    queryKey: ['obras', ambiente],
    enabled: Boolean(supabase),
    queryFn: () => listarObras(ambiente),
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
    mutationFn: ({ inicio, nome, modeloId }: { inicio: string; nome: string; modeloId: string }) =>
      gerarObra(inicio, nome, modeloId),
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
