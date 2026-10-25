import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import {
  adiarPendencia,
  apontarPendencia,
  resolverPendencia,
  trazerPendencia,
  vistoriarPendencia,
  type NovaPendencia,
} from './campo';
import { loadPendencias } from './pendenciasObra';

export function useObraPendencias(obraId: string) {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['pendencias', obraId] });

  const query = useQuery({
    queryKey: ['pendencias', obraId],
    enabled: Boolean(supabase) && Boolean(obraId),
    queryFn: () => loadPendencias(obraId),
  });

  const apontar = useMutation({
    mutationFn: (v: { dados: NovaPendencia; file: File }) =>
      apontarPendencia(obraId, v.dados, v.file),
    onSuccess: inval,
  });
  const resolver = useMutation({
    mutationFn: (v: { id: string; file: File }) => resolverPendencia(obraId, v.id, v.file),
    onSuccess: inval,
  });
  const adiar = useMutation({
    mutationFn: (v: { id: string; data: string; motivo: string }) =>
      adiarPendencia(v.id, v.data, v.motivo),
    onSuccess: inval,
  });
  const trazer = useMutation({
    mutationFn: (id: string) => trazerPendencia(id),
    onSuccess: inval,
  });
  const vistoriar = useMutation({
    mutationFn: (v: { id: string; aprovado: boolean; motivo?: string }) =>
      vistoriarPendencia(v.id, v.aprovado, v.motivo),
    onSuccess: inval,
  });

  return { query, apontar, resolver, adiar, trazer, vistoriar };
}
