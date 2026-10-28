import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { topoFila } from '@contro/core';
import { supabase } from '../../lib/supabase';
import { enfileirar } from '../../lib/sync';
import { type NovaPendencia } from './campo';
import { guardarFotoLocal } from './foto';
import { loadPendencias, type PendenciaObra } from './pendenciasObra';

export function useObraPendencias(obraId: string) {
  const qc = useQueryClient();
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

  // Apontar: otimista e offline. Gera o id no cliente (o MESMO para o card
  // otimista e para a op, para que ações na pendência recém-criada usem o id
  // real), guarda a foto do antes no Dexie (sobe em 2º plano) e enfileira.
  type ApontarVars = { dados: NovaPendencia; file: File; pendenciaId?: string };
  const apontar = useMutation({
    networkMode: 'always',
    mutationFn: async (v: ApontarVars) => {
      const pendenciaId = v.pendenciaId ?? crypto.randomUUID();
      const fotoLocalId = await guardarFotoLocal(obraId, v.file);
      await enfileirar('apontar_pendencia', { obraId, pendenciaId, dados: v.dados, fotoLocalId });
      return pendenciaId;
    },
    onMutate: async (v: ApontarVars) => {
      // onMutate roda antes do mutationFn com o mesmo objeto; fixa o id aqui.
      const pendenciaId = v.pendenciaId ?? crypto.randomUUID();
      v.pendenciaId = pendenciaId;
      await qc.cancelQueries({ queryKey: ['pendencias', obraId] });
      const prev = qc.getQueryData<PendenciaObra[]>(['pendencias', obraId]);
      const nova: PendenciaObra = {
        id: pendenciaId,
        obra_id: obraId,
        atividade_id: v.dados.atividadeId,
        titulo: v.dados.titulo,
        local: v.dados.local,
        criticidade: v.dados.criticidade,
        status: 'aberta',
        ordem_fila: topoDaFila(),
        adiada_ate: null,
        motivo_adiamento: null,
        apontada_em: new Date().toISOString(),
        resolvida_por: null,
        resolvida_em: null,
        vistoriada_por: null,
        vistoriada_em: null,
        // A miniatura do antes aparece após o drain (a foto sobe em 2º plano);
        // não usamos objectURL aqui para não vazar blob ao substituir o card.
        fotoAntesUrl: null,
        fotoDepoisUrl: null,
        apontouNome: null,
        resolveuNome: null,
        atividadeNome: null,
      };
      qc.setQueryData<PendenciaObra[]>(['pendencias', obraId], [...(prev ?? []), nova]);
      return { prev };
    },
    onError: (_e, _v, ctx) => reverter(ctx),
  });
  // Resolver: otimista e offline. Guarda a foto de depois no Dexie (sobe em 2º
  // plano) e enfileira; manda a pendência para vistoria na hora.
  const resolver = useMutation({
    networkMode: 'always',
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
    networkMode: 'always',
    mutationFn: (v: { id: string; data: string; motivo: string }) =>
      enfileirar('adiar_pendencia', { obraId, id: v.id, data: v.data, motivo: v.motivo }),
    onMutate: (v: { id: string; data: string; motivo: string }) =>
      patch(v.id, (p) => ({ ...p, adiada_ate: v.data, motivo_adiamento: v.motivo })),
    onError: (_e, _v, ctx) => reverter(ctx),
  });
  const trazer = useMutation({
    networkMode: 'always',
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
    networkMode: 'always',
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

  // Editar e apagar (lista completa): otimistas e offline, apagar com Desfazer.
  const editar = useMutation({
    networkMode: 'always',
    mutationFn: (v: { id: string; dados: NovaPendencia; atividadeNome: string | null }) =>
      enfileirar('editar_pendencia', { obraId, id: v.id, dados: v.dados }),
    onMutate: (v: { id: string; dados: NovaPendencia; atividadeNome: string | null }) =>
      patch(v.id, (p) => ({
        ...p,
        titulo: v.dados.titulo,
        local: v.dados.local,
        criticidade: v.dados.criticidade,
        atividade_id: v.dados.atividadeId,
        atividadeNome: v.atividadeNome,
      })),
    onError: (_e, _v, ctx) => reverter(ctx),
  });
  const excluir = useMutation({
    networkMode: 'always',
    mutationFn: (id: string) => enfileirar('excluir_pendencia', { obraId, id }),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['pendencias', obraId] });
      const prev = qc.getQueryData<PendenciaObra[]>(['pendencias', obraId]);
      if (prev)
        qc.setQueryData<PendenciaObra[]>(
          ['pendencias', obraId],
          prev.filter((p) => p.id !== id),
        );
      return { prev };
    },
    onError: (_e, _v, ctx) => reverter(ctx),
  });
  // Desfazer do apagar: devolve a pendência (a tela guarda o objeto) na hora.
  const restaurar = useMutation({
    networkMode: 'always',
    mutationFn: (p: PendenciaObra) => enfileirar('restaurar_pendencia', { obraId, id: p.id }),
    onMutate: async (p: PendenciaObra) => {
      await qc.cancelQueries({ queryKey: ['pendencias', obraId] });
      const prev = qc.getQueryData<PendenciaObra[]>(['pendencias', obraId]);
      qc.setQueryData<PendenciaObra[]>(
        ['pendencias', obraId],
        [...(prev ?? []).filter((x) => x.id !== p.id), p],
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => reverter(ctx),
  });

  return { query, apontar, resolver, adiar, trazer, vistoriar, editar, excluir, restaurar };
}
