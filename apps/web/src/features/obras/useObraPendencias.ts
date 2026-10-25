import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { topoFila } from '@obdc/core';
import { supabase } from '../../lib/supabase';
import { enfileirar } from '../../lib/sync';
import { apontarPendencia, type NovaPendencia } from './campo';
import { guardarFotoLocal } from './foto';
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

  // apontar (insert com foto) segue online nesta fatia: depende de id gerado no
  // cliente (próxima fatia).
  const apontar = useMutation({
    mutationFn: (v: { dados: NovaPendencia; file: File }) =>
      apontarPendencia(obraId, v.dados, v.file),
    onSuccess: inval,
  });
  // Resolver: otimista e offline. Guarda a foto de depois no Dexie (sobe em 2º
  // plano) e enfileira; manda a pendência para vistoria na hora.
  const resolver = useMutation({
    mutationFn: async (v: { id: string; file: File; pessoaId: string | null }) => {
      const fotoLocalId = await guardarFotoLocal(obraId, v.file);
      await enfileirar('resolver_pendencia', { obraId, id: v.id, fotoLocalId });
    },
    onMutate: (v: { id: string; file: File; pessoaId: string | null }) =>
      patch(v.id, (p) => ({
        ...p,
        status: 'em_vistoria',
        resolvida_por: v.pessoaId ?? p.resolvida_por,
      })),
    onError: (_e, _v, ctx) => reverter(ctx),
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
