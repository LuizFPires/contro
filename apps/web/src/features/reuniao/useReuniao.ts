import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RespostaReuniao, SecaoResposta } from '@contro/core';
import { supabase } from '../../lib/supabase';
import {
  concluirAtividade,
  concluirTarefa,
  definirAvanco,
  desfazerConclusao,
  marcarProvidencia,
  reabrirTarefa,
  salvarTarefa,
  type EntradaTarefa,
} from '../obras/campo';
import {
  chaveResposta,
  fecharReuniao,
  responderReuniao,
  type ReuniaoCompleta,
  loadReuniao,
  reabrirReuniao,
  salvarObservacao,
  type SnapshotObra,
} from './reuniaoApi';

/** data no formato ISO (segunda da semana). */
export function useReuniao(data: string) {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['reuniao', data] });

  const query = useQuery({
    queryKey: ['reuniao', data],
    enabled: Boolean(supabase) && Boolean(data),
    queryFn: () => loadReuniao(data),
  });

  const observacao = useMutation({
    mutationFn: (v: { reuniaoId: string; obraId: string; texto: string }) =>
      salvarObservacao(v.reuniaoId, v.obraId, v.texto),
    onSuccess: inval,
  });

  const fechar = useMutation({
    mutationFn: (v: { id: string; snapshots: SnapshotObra[] }) => fecharReuniao(v.id, v.snapshots),
    onSuccess: inval,
  });

  /** Gestor reabre a pauta (ata fechada que ficou vazia, por exemplo). */
  const reabrir = useMutation({
    mutationFn: (id: string) => reabrirReuniao(id),
    onSuccess: inval,
  });

  /** Cria ou edita (remarca) uma providência da pauta. */
  const salvarProvidencia = useMutation({
    mutationFn: (v: { obraId: string; entrada: EntradaTarefa }) =>
      salvarTarefa(v.obraId, v.entrada),
    onSuccess: inval,
  });

  /** "Feito" numa atividade da semana passada: conclui sem foto. */
  const concluirAtv = useMutation({
    mutationFn: (atividadeId: string) => concluirAtividade(atividadeId, null),
    onSuccess: () => {
      void inval();
      void qc.invalidateQueries({ queryKey: ['obras'] });
    },
  });

  /** Providência da reunião anterior: "Feita" (e Desfazer). */
  const marcarFeita = useMutation({
    mutationFn: (v: { id: string; feita: boolean }) =>
      v.feita ? concluirTarefa(v.id) : reabrirTarefa(v.id),
    onSuccess: inval,
  });

  /** Resposta da pauta: otimista (o botão marca na hora); null apaga (Desfazer). */
  const responder = useMutation({
    mutationFn: (v: {
      reuniaoId: string;
      obraId: string;
      secao: SecaoResposta;
      itemId: string;
      resposta: RespostaReuniao | null;
    }) => responderReuniao(v),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['reuniao', data] });
      const prev = qc.getQueryData<ReuniaoCompleta | null>(['reuniao', data]);
      if (prev) {
        const respostas = { ...prev.respostas };
        const k = chaveResposta(v.secao, v.itemId);
        if (v.resposta) respostas[k] = v.resposta;
        else delete respostas[k];
        qc.setQueryData(['reuniao', data], { ...prev, respostas });
      }
      return { prev };
    },
    // Sucesso não recarrega a pauta (a resposta já está no cache); erro volta e confere.
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['reuniao', data], ctx.prev);
      void inval();
    },
  });

  /** Desfaz o "Terminou" (volta a atividade a aberta). */
  const desfazerAtv = useMutation({
    mutationFn: (atividadeId: string) => desfazerConclusao(atividadeId),
    onSuccess: () => {
      void inval();
      void qc.invalidateQueries({ queryKey: ['obras'] });
    },
  });

  /** "Quanto andou?" na pauta: grava o avanço da atividade (0..99). */
  const avancoAtv = useMutation({
    mutationFn: (v: { atividadeId: string; pct: number }) => definirAvanco(v.atividadeId, v.pct),
    onSuccess: () => {
      void inval();
      void qc.invalidateQueries({ queryKey: ['obras'] });
    },
  });

  /** "Já providenciado": marca o lembrete (contratar, alugar, comprar) como feito. */
  const marcarProv = useMutation({
    mutationFn: (v: { id: string; feito: boolean }) => marcarProvidencia(v.id, v.feito),
    onSuccess: () => {
      void inval();
      void qc.invalidateQueries({ queryKey: ['obras'] });
    },
  });

  return {
    query,
    observacao,
    fechar,
    salvarProvidencia,
    concluirAtv,
    marcarFeita,
    reabrir,
    responder,
    desfazerAtv,
    avancoAtv,
    marcarProv,
  };
}
