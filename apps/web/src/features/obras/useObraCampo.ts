import { nomeCurto } from '@contro/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enfileirar } from '../../lib/sync';
import {
  adicionarAtividade,
  adicionarMapa,
  adicionarPredecessora,
  adicionarProvidencia,
  ajustarInicio,
  editarDuracao,
  excluirAtividade,
  removerPredecessora,
  removerProvidencia,
  restaurarAtividade,
} from './campo';
import { guardarFotoLocal } from './foto';
import type { ObraCompleta } from './detalhe';
import type { TarefaObra } from './tarefasObra';

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
  // Prestador: otimista e offline (fila), para não perder o que foi digitado.
  const prestador = useMutation({
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['propostas-mapa', obraId] });
      void qc.invalidateQueries({ queryKey: ['reuniao'] });
      void qc.invalidateQueries({ queryKey: ['sugestao', 'prestador'] });
    },
    networkMode: 'always',
    mutationFn: ({ id, prestador }: { id: string; prestador: string | null }) =>
      enfileirar('editar_prestador', { obraId, id, prestador }),
    onMutate: async ({ id, prestador }: { id: string; prestador: string | null }) => {
      await qc.cancelQueries({ queryKey: ['obra', obraId] });
      const prev = qc.getQueryData<ObraCompleta>(['obra', obraId]);
      if (prev)
        qc.setQueryData<ObraCompleta>(['obra', obraId], {
          ...prev,
          atividades: prev.atividades.map((a) => (a.id === id ? { ...a, prestador } : a)),
        });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['obra', obraId], ctx.prev);
    },
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
      // Quem marcou: a pessoa logada (o servidor grava o mesmo em feito_por).
      const eu = nomeCurto(qc.getQueryData<{ nome: string } | null>(['perfil'])?.nome) || null;
      if (prev) {
        qc.setQueryData<ObraCompleta>(['obra', obraId], {
          ...prev,
          atividades: prev.atividades.map((a) => ({
            ...a,
            providencias: a.providencias.map((p) =>
              p.id === id
                ? {
                    ...p,
                    status: feito ? 'feito' : 'pendente',
                    feito_em: feito ? new Date().toISOString() : null,
                    feito_por_nome: feito ? eu : null,
                  }
                : p,
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
  const restaurarProv = useMutation({
    mutationFn: (id: string) => removerProvidencia(id, true),
    onSuccess: inval,
  });
  const removerProv = useMutation({
    mutationFn: (id: string) => removerProvidencia(id),
    onSuccess: inval,
  });
  const inicio = useMutation({
    mutationFn: ({ id, data }: { id: string; data: string | null }) => ajustarInicio(id, data),
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
  // Patch otimista de uma atividade na obra em cache (cancela refetch, guarda o anterior).
  const patchAtv = async (
    atividadeId: string,
    troca: (a: ObraCompleta['atividades'][number]) => ObraCompleta['atividades'][number],
    xp = 0,
  ) => {
    await qc.cancelQueries({ queryKey: ['obra', obraId] });
    const prev = qc.getQueryData<ObraCompleta>(['obra', obraId]);
    if (prev) {
      qc.setQueryData<ObraCompleta>(['obra', obraId], {
        ...prev,
        xp: Math.max(0, prev.xp + xp),
        atividades: prev.atividades.map((a) => (a.id === atividadeId ? troca(a) : a)),
      });
    }
    return { prev };
  };
  const reverter = (ctx: { prev?: ObraCompleta } | undefined) => {
    if (ctx?.prev) qc.setQueryData(['obra', obraId], ctx.prev);
  };

  // Conclusão OTIMISTA e offline, COM ou SEM foto: a foto (se houver) fica no
  // Dexie e sobe em 2º plano; a op é idempotente. Fase/XP vêm do core.
  const concluir = useMutation({
    networkMode: 'always',
    mutationFn: async (v: {
      atividadeId: string;
      file: File | null;
      faseFechada?: boolean;
      xp?: number;
    }) => {
      const fotoLocalId = v.file ? await guardarFotoLocal(obraId, v.file) : null;
      await enfileirar('concluir_atividade', { obraId, atividadeId: v.atividadeId, fotoLocalId });
      return { xp: v.xp ?? 50, fase_fechada: v.faseFechada ?? false };
    },
    onMutate: async (v) => {
      const ctx = await patchAtv(
        v.atividadeId,
        (a) => ({
          ...a,
          concluida_em: new Date().toISOString(),
          // Marca "com foto" na hora; o id real chega quando a foto sobe.
          foto_conclusao_id: v.file ? 'pendente' : null,
        }),
        v.xp ?? 50,
      );
      // O servidor fecha as tarefas abertas vinculadas à atividade: espelha aqui.
      // (O sync refaz ['tarefas'] e ['obras'] quando o servidor confirma.)
      await qc.cancelQueries({ queryKey: ['tarefas', obraId] });
      const prevTarefas = qc.getQueryData<TarefaObra[]>(['tarefas', obraId]);
      if (prevTarefas)
        qc.setQueryData<TarefaObra[]>(
          ['tarefas', obraId],
          prevTarefas.map((t) =>
            t.vinculo_tipo === 'atividade' &&
            t.vinculo_id === v.atividadeId &&
            t.status === 'aberta'
              ? { ...t, status: 'feita', feita_em: new Date().toISOString() }
              : t,
          ),
        );
      return { ...ctx, prevTarefas };
    },
    onError: (_e, _v, ctx) => {
      reverter(ctx);
      if (ctx?.prevTarefas) qc.setQueryData(['tarefas', obraId], ctx.prevTarefas);
    },
  });

  // Anexar a foto a uma atividade concluída sem foto (otimista e offline).
  const anexarFoto = useMutation({
    networkMode: 'always',
    mutationFn: async (v: { atividadeId: string; file: File }) => {
      const fotoLocalId = await guardarFotoLocal(obraId, v.file);
      await enfileirar('anexar_foto_conclusao', {
        obraId,
        atividadeId: v.atividadeId,
        fotoLocalId,
      });
    },
    onMutate: (v) => patchAtv(v.atividadeId, (a) => ({ ...a, foto_conclusao_id: 'pendente' })),
    onError: (_e, _v, ctx) => reverter(ctx),
  });

  // "Desfazer" da conclusão (regra 10): reabre na hora e devolve o XP.
  const desfazer = useMutation({
    networkMode: 'always',
    mutationFn: (v: { atividadeId: string; xp: number }) =>
      enfileirar('desfazer_conclusao', { obraId, atividadeId: v.atividadeId }),
    onMutate: (v) =>
      patchAtv(
        v.atividadeId,
        (a) => ({ ...a, concluida_em: null, foto_conclusao_id: null }),
        -v.xp,
      ),
    onError: (_e, _v, ctx) => reverter(ctx),
  });

  // Avanço parcial (anel da trilha e cards da ficha): otimista e offline.
  const avanco = useMutation({
    networkMode: 'always',
    mutationFn: (v: { atividadeId: string; pct: number }) =>
      enfileirar('definir_avanco', { obraId, atividadeId: v.atividadeId, pct: v.pct }),
    onMutate: (v) => patchAtv(v.atividadeId, (a) => ({ ...a, avanco_pct: v.pct })),
    onError: (_e, _v, ctx) => reverter(ctx),
  });

  // Desfazer de "Voltar para pendente": conclui de novo, com a mesma foto se havia.
  const reconcluir = useMutation({
    networkMode: 'always',
    mutationFn: (v: { atividadeId: string; fotoId: string | null; xp?: number }) =>
      enfileirar('concluir_atividade', { obraId, atividadeId: v.atividadeId, fotoId: v.fotoId }),
    onMutate: (v) =>
      patchAtv(
        v.atividadeId,
        (a) => ({ ...a, concluida_em: new Date().toISOString(), foto_conclusao_id: v.fotoId }),
        v.xp ?? 50,
      ),
    onError: (_e, _v, ctx) => reverter(ctx),
  });

  // Textos livres da obra (nome da atividade, descrição do lembrete): otimista.
  const renomear = useMutation({
    networkMode: 'always',
    mutationFn: (v: { atividadeId: string; nome: string }) =>
      enfileirar('renomear_atividade', { obraId, id: v.atividadeId, nome: v.nome }),
    onMutate: (v) => patchAtv(v.atividadeId, (a) => ({ ...a, nome: v.nome })),
    onError: (_e, _v, ctx) => reverter(ctx),
  });
  const descricaoProv = useMutation({
    networkMode: 'always',
    mutationFn: (v: { atividadeId: string; id: string; descricao: string }) =>
      enfileirar('editar_descricao_providencia', { obraId, id: v.id, descricao: v.descricao }),
    onMutate: (v) =>
      patchAtv(v.atividadeId, (a) => ({
        ...a,
        providencias: a.providencias.map((p) =>
          p.id === v.id ? { ...p, descricao: v.descricao } : p,
        ),
      })),
    onError: (_e, _v, ctx) => reverter(ctx),
  });

  // Cards da fase: adicionar e excluir (exclusão lógica, com Desfazer).
  const novaAtividade = useMutation({
    mutationFn: (v: { faseId: string; nome: string; duracaoDu: number; predecessoras: string[] }) =>
      adicionarAtividade({ obraId, ...v }),
    onSettled: inval,
  });
  // Item do Mapa de coleta (pré-obra): igual ao card novo; inval também refaz ['obras'] (agenda).
  const novoMapa = useMutation({
    mutationFn: (v: {
      nome: string;
      duracaoDu: number;
      antecedenciaDu: number;
      libera: string[];
      id?: string;
    }) => adicionarMapa({ obraId, ...v }),
    onSettled: inval,
  });
  const excluir = useMutation({
    mutationFn: (atividadeId: string) => excluirAtividade(atividadeId),
    onMutate: async (atividadeId: string) => {
      await qc.cancelQueries({ queryKey: ['obra', obraId] });
      const prev = qc.getQueryData<ObraCompleta>(['obra', obraId]);
      if (prev)
        qc.setQueryData<ObraCompleta>(['obra', obraId], {
          ...prev,
          atividades: prev.atividades.filter(
            (a) => a.id !== atividadeId && a.pai_id !== atividadeId,
          ),
        });
      return { prev };
    },
    onError: (_e, _v, ctx) => reverter(ctx),
    onSettled: inval,
  });
  const restaurar = useMutation({
    mutationFn: (atividadeId: string) => restaurarAtividade(atividadeId),
    onSettled: inval,
  });

  return {
    novaAtividade,
    novoMapa,
    excluir,
    restaurar,
    renomear,
    descricaoProv,
    subitem,
    prestador,
    providencia,
    addProvidencia,
    removerProv,
    restaurarProv,
    inicio,
    duracao,
    addPred,
    removerPred,
    concluir,
    anexarFoto,
    desfazer,
    reconcluir,
    avanco,
  };
}

/**
 * Desfazer da conclusão feita pela câmera da tarefa (Tarefas da equipe e
 * Minhas ações): reabre a atividade de qualquer obra, otimista e offline. A
 * tela reabre a tarefa logo depois (desfazer_conclusao não mexe em tarefas).
 */
export function useReabrirAtividade() {
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (v: { obraId: string; atividadeId: string }) =>
      enfileirar('desfazer_conclusao', { obraId: v.obraId, atividadeId: v.atividadeId }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['obra', v.obraId] });
      const prev = qc.getQueryData<ObraCompleta>(['obra', v.obraId]);
      if (prev)
        qc.setQueryData<ObraCompleta>(['obra', v.obraId], {
          ...prev,
          // Devolve o XP otimista da conclusão (o servidor acerta no sync).
          xp: Math.max(0, prev.xp - 50),
          atividades: prev.atividades.map((a) =>
            a.id === v.atividadeId ? { ...a, concluida_em: null, foto_conclusao_id: null } : a,
          ),
        });
      return { prev };
    },
    onError: (_e, v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['obra', v.obraId], ctx.prev);
    },
  });
}
