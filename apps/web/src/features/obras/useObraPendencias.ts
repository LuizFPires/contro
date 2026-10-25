import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { topoFila } from '@obdc/core';
import { supabase } from '../../lib/supabase';
import { enfileirar } from '../../lib/sync';
import { apontarPendencia, resolverPendencia, type NovaPendencia } from './campo';
import { loadPendencias, type PendenciaObra } from './pendenciasObra';

export function useObraPendencias(obraId: string) {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['pendencias', obraId] });

  const query = useQuery({
    queryKey: ['pendencias', obraId],
    enabled: Boolean(supabase) && Boolean(obraId),
    queryFn: () => loadPendencias(obraId),
  });

  // Patch otimista na lista de pendências (cancela refetch, guarda o anterior).
  const patch = async (id: string, troca: (p: PendenciaObra) => PendenciaObra) => {
    await qc.cancelQueries({ queryKey: ['pendencias', obraId] });
    const prev = qc.getQueryData<PendenciaObra[]>(['pendencias', obraId]);
    if (prev) {
      qc.setQueryData<PendenciaObra[]>(
        ['pendencias', obraId],
        prev.map((p) => (p.id === id ? troca(p) : p)),
      );
    }
    return { prev };
  };
  const reverter = (ctx: { prev?: PendenciaObra[] } | undefined) => {
    if (ctx?.prev) qc.setQueryData(['pendencias', obraId], ctx.prev);
  };
  // Topo da fila a partir do cache (regra espelhada do servidor vem do core).
  const topoDaFila = () => {
    const lista = qc.getQueryData<PendenciaObra[]>(['pendencias', obraId]) ?? [];
    return topoFila(lista.map((p) => p.ordem_fila));
  };

  // apontar (insert com foto) e resolver (foto de depois) seguem online nesta
  // fatia: dependem de id gerado no cliente / foto em 2º plano (fatia 5).
  const apontar = useMutation({
    mutationFn: (v: { dados: NovaPendencia; file: File }) =>
      apontarPendencia(obraId, v.dados, v.file),
    onSuccess: inval,
  });
  const resolver = useMutation({
    mutationFn: (v: { id: string; file: File }) => resolverPendencia(obraId, v.id, v.file),
    onSuccess: inval,
  });

  // Ações de campo otimistas, offline e idempotentes.
  const adiar = useMutation({
    mutationFn: (v: { id: string; data: string; motivo: string }) =>
      enfileirar('adiar_pendencia', { obraId, id: v.id, data: v.data, motivo: v.motivo }),
    onMutate: (v: { id: string; data: string; motivo: string }) =>
      patch(v.id, (p) => ({ ...p, adiada_ate: v.data, motivo_adiamento: v.motivo })),
    onError: (_e, _v, ctx) => reverter(ctx),
  });
  const trazer = useMutation({
    mutationFn: (id: string) => enfileirar('trazer_pendencia', { obraId, id }),
    onMutate: (id: string) => {
      const topo = topoDaFila();
      return patch(id, (p) => ({
        ...p,
        adiada_ate: null,
        motivo_adiamento: null,
        ordem_fila: topo,
      }));
    },
    onError: (_e, _v, ctx) => reverter(ctx),
  });
  const vistoriar = useMutation({
    mutationFn: (v: { id: string; aprovado: boolean; motivo?: string }) =>
      enfileirar('vistoriar_pendencia', {
        obraId,
        id: v.id,
        aprovado: v.aprovado,
        motivo: v.motivo ?? null,
      }),
    onMutate: (v: { id: string; aprovado: boolean; motivo?: string }) => {
      if (v.aprovado) return patch(v.id, (p) => ({ ...p, status: 'fechada' }));
      const topo = topoDaFila();
      return patch(v.id, (p) => ({
        ...p,
        status: 'aberta',
        resolvida_por: null,
        resolvida_em: null,
        resolveuNome: null,
        fotoDepoisUrl: null,
        adiada_ate: null,
        motivo_adiamento: null,
        ordem_fila: topo,
      }));
    },
    onError: (_e, _v, ctx) => reverter(ctx),
  });

  return { query, apontar, resolver, adiar, trazer, vistoriar };
}
