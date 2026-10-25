import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enfileirar } from '../../lib/sync';
import {
  adicionarPredecessora,
  adicionarProvidencia,
  ajustarInicio,
  editarDuracao,
  editarPrestador,
  removerPredecessora,
  removerProvidencia,
} from './campo';
import { guardarFotoLocal } from './foto';
import type { ObraCompleta } from './detalhe';

export function useObraCampo(obraId: string) {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['obra', obraId] });
    qc.invalidateQueries({ queryKey: ['obras'] });
  };

  // Marcar subitem: otimista e offline (patch na obra, enfileira a op idempotente).
  const subitem = useMutation({
    networkMode: 'always',
    mutationFn: ({ id, feito }: { id: string; feito: boolean }) =>
      enfileirar('marcar_subitem', { obraId, subitemId: id, feito }),
    onMutate: async ({ id, feito }: { id: string; feito: boolean }) => {
      await qc.cancelQueries({ queryKey: ['obra', obraId] });
      const prev = qc.getQueryData<ObraCompleta>(['obra', obraId]);
      if (prev) {
        qc.setQueryData<ObraCompleta>(['obra', obraId], {
          ...prev,
          atividades: prev.atividades.map((a) =>
            a.id === id ? { ...a, concluida_em: feito ? new Date().toISOString() : null } : a,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['obra', obraId], ctx.prev);
    },
  });
  const prestador = useMutation({
    mutationFn: ({ id, prestador }: { id: string; prestador: string | null }) =>
      editarPrestador(id, prestador),
    onSuccess: inval,
  });
  // Ação de campo OTIMISTA e offline (regra 9): atualiza o cache na hora, enfileira
  // a op (client_op_id idempotente) e o sync envia ao servidor quando houver sinal.
  const providencia = useMutation({
    // 'always': a ação offline grava só no Dexie (enfileirar); sem isso o
    // TanStack Query PAUSA o mutationFn quando offline e a op nunca é enfileirada.
    networkMode: 'always',
    mutationFn: ({ id, feito }: { id: string; feito: boolean }) =>
      enfileirar('marcar_providencia', { obraId, id, feito }),
    onMutate: async ({ id, feito }: { id: string; feito: boolean }) => {
      await qc.cancelQueries({ queryKey: ['obra', obraId] });
      const prev = qc.getQueryData<ObraCompleta>(['obra', obraId]);
      if (prev) {
        qc.setQueryData<ObraCompleta>(['obra', obraId], {
          ...prev,
          atividades: prev.atividades.map((a) => ({
            ...a,
            providencias: a.providencias.map((p) =>
              p.id === id ? { ...p, status: feito ? 'feito' : 'pendente' } : p,
            ),
          })),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['obra', obraId], ctx.prev);
    },
  });
  const addProvidencia = useMutation({
    mutationFn: (p: {
      atividadeId: string;
      tipo: 'contratacao' | 'locacao' | 'compra';
      descricao: string;
    }) => adicionarProvidencia(obraId, p.atividadeId, p.tipo, p.descricao),
    onSuccess: inval,
  });
  const removerProv = useMutation({
    mutationFn: (id: string) => removerProvidencia(id),
    onSuccess: inval,
  });
  const inicio = useMutation({
    mutationFn: ({ id, data }: { id: string; data: string }) => ajustarInicio(id, data),
    onSuccess: inval,
  });
  const duracao = useMutation({
    mutationFn: ({ id, du }: { id: string; du: number }) => editarDuracao(id, du),
    onSuccess: inval,
  });
  const addPred = useMutation({
    mutationFn: (v: { atividadeId: string; predecessoraId: string }) =>
      adicionarPredecessora(obraId, v.atividadeId, v.predecessoraId),
    onSuccess: inval,
  });
  const removerPred = useMutation({
    mutationFn: (v: { atividadeId: string; predecessoraId: string }) =>
      removerPredecessora(obraId, v.atividadeId, v.predecessoraId),
    onSuccess: inval,
  });
  // Conclusão OTIMISTA e offline: guarda a foto no Dexie (sobe em 2º plano),
  // enfileira a op (idempotente) e marca a atividade concluída na hora. A fase/XP
  // são calculados no cliente e devolvidos para a celebração.
  const concluir = useMutation({
    networkMode: 'always',
    mutationFn: async (v: {
      atividadeId: string;
      file: File;
      faseFechada?: boolean;
      xp?: number;
    }) => {
      const fotoLocalId = await guardarFotoLocal(obraId, v.file);
      await enfileirar('concluir_atividade', { obraId, atividadeId: v.atividadeId, fotoLocalId });
      return { xp: v.xp ?? 50, fase_fechada: v.faseFechada ?? false };
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['obra', obraId] });
      const prev = qc.getQueryData<ObraCompleta>(['obra', obraId]);
      if (prev) {
        qc.setQueryData<ObraCompleta>(['obra', obraId], {
          ...prev,
          xp: prev.xp + (v.xp ?? 50),
          atividades: prev.atividades.map((a) =>
            a.id === v.atividadeId ? { ...a, concluida_em: new Date().toISOString() } : a,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['obra', obraId], ctx.prev);
    },
  });

  return {
    subitem,
    prestador,
    providencia,
    addProvidencia,
    removerProv,
    inicio,
    duracao,
    addPred,
    removerPred,
    concluir,
  };
}
