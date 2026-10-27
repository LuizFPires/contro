import { nomeCurto } from '@contro/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enfileirar } from '../../lib/sync';
import {
  adicionarAtividade,
  adicionarPredecessora,
  adicionarProvidencia,
  ajustarInicio,
  editarDescricaoProvidencia,
  editarDuracao,
  editarPrestador,
  excluirAtividade,
  removerPredecessora,
  removerProvidencia,
  renomearAtividade,
  restaurarAtividade,
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
    onSuccess: () => {
      inval();
      // O nome salvo vira sugestão no banco (trigger): recarrega a lista.
      void qc.invalidateQueries({ queryKey: ['sugestao', 'prestador'] });
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
    onMutate: (v) =>
      patchAtv(
        v.atividadeId,
        (a) => ({
          ...a,
          concluida_em: new Date().toISOString(),
          // Marca "com foto" na hora; o id real chega quando a foto sobe.
          foto_conclusao_id: v.file ? 'pendente' : null,
        }),
        v.xp ?? 50,
      ),
    onError: (_e, _v, ctx) => reverter(ctx),
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
    mutationFn: (v: { atividadeId: string; nome: string }) =>
      renomearAtividade(v.atividadeId, v.nome),
    onMutate: (v) => patchAtv(v.atividadeId, (a) => ({ ...a, nome: v.nome })),
    onError: (_e, _v, ctx) => reverter(ctx),
    onSettled: inval,
  });
  const descricaoProv = useMutation({
    mutationFn: (v: { atividadeId: string; id: string; descricao: string }) =>
      editarDescricaoProvidencia(v.id, v.descricao),
    onMutate: (v) =>
      patchAtv(v.atividadeId, (a) => ({
        ...a,
        providencias: a.providencias.map((p) =>
          p.id === v.id ? { ...p, descricao: v.descricao } : p,
        ),
      })),
    onError: (_e, _v, ctx) => reverter(ctx),
    onSettled: inval,
  });

  // Cards da fase: adicionar e excluir (exclusão lógica, com Desfazer).
  const novaAtividade = useMutation({
    mutationFn: (v: { faseId: string; nome: string; duracaoDu: number; predecessoras: string[] }) =>
      adicionarAtividade({ obraId, ...v }),
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
    excluir,
    restaurar,
    renomear,
    descricaoProv,
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
    anexarFoto,
    desfazer,
    reconcluir,
  };
}
