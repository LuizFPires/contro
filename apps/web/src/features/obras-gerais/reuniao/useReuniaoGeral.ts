import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RespostaReuniao, SecaoResposta } from '@contro/core';
import { supabase } from '../../../lib/supabase';
import {
  concluirAtividade,
  concluirTarefa,
  desfazerConclusao,
  marcarProvidencia,
  reabrirTarefa,
  salvarTarefa,
  type EntradaTarefa,
} from '../../obras/campo';
import { chaveResposta, responderReuniao, salvarObservacao } from '../../reuniao/reuniaoApi';
import {
  carregarReuniaoGeral,
  fecharReuniaoGeral,
  reabrirReuniaoGeral,
  type ReuniaoGeral,
} from './reuniaoGeralApi';

export const chaveReuniaoGeral = (obraId: string, data: string) => ['reuniao-geral', obraId, data];

/**
 * Reunião da obra geral na data, com as ações da pauta. Mesmo comportamento da
 * `useReuniao` da Contorno (resposta otimista; o resto recarrega a reunião e a obra).
 */
export function useReuniaoGeral(obraId: string, data: string, criar: boolean) {
  const qc = useQueryClient();
  const key = chaveReuniaoGeral(obraId, data);
  const inval = () => qc.invalidateQueries({ queryKey: key });
  // A obra (trilha, check list) e o resumo (Hoje, ações) mudam junto.
  const invalObra = () => {
    void inval();
    void qc.invalidateQueries({ queryKey: ['obra', obraId] });
    void qc.invalidateQueries({ queryKey: ['obras-gerais', 'resumo'] });
  };

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(supabase) && Boolean(obraId) && Boolean(data),
    queryFn: () => carregarReuniaoGeral(obraId, data, criar),
  });

  const observacao = useMutation({
    mutationFn: (v: { reuniaoId: string; texto: string }) =>
      salvarObservacao(v.reuniaoId, obraId, v.texto),
    onSuccess: inval,
  });

  const fechar = useMutation({
    mutationFn: (v: {
      id: string;
      snapshot: { eficienciaPct: number | null; atrasadas: number };
    }) => fecharReuniaoGeral(v.id, v.snapshot),
    onSuccess: () => {
      void inval();
      void qc.invalidateQueries({ queryKey: ['reunioes-gerais'] });
    },
  });

  const reabrir = useMutation({
    mutationFn: (id: string) => reabrirReuniaoGeral(id),
    onSuccess: () => {
      void inval();
      void qc.invalidateQueries({ queryKey: ['reunioes-gerais'] });
    },
  });

  /** Cria ou edita uma ação (tarefa) da pauta; devolve o id. */
  const salvarAcao = useMutation({
    mutationFn: (entrada: EntradaTarefa) => salvarTarefa(obraId, entrada),
    onSuccess: invalObra,
  });

  /** "Terminou" numa atividade da semana passada: conclui sem foto. */
  const concluirAtv = useMutation({
    mutationFn: (atividadeId: string) => concluirAtividade(atividadeId, null),
    onSuccess: invalObra,
  });

  const desfazerAtv = useMutation({
    mutationFn: (atividadeId: string) => desfazerConclusao(atividadeId),
    onSuccess: invalObra,
  });

  /** Cobrança: "Feita" (e Desfazer). */
  const marcarFeita = useMutation({
    mutationFn: (v: { id: string; feita: boolean }) =>
      v.feita ? concluirTarefa(v.id) : reabrirTarefa(v.id),
    onSuccess: invalObra,
  });

  /** "Já providenciado": marca o lembrete como feito. */
  const marcarProv = useMutation({
    mutationFn: (v: { id: string; feito: boolean }) => marcarProvidencia(v.id, v.feito),
    onSuccess: invalObra,
  });

  const trocarResposta = (k: string, resposta: RespostaReuniao | null, tarefaId?: string) => {
    const atual = qc.getQueryData<ReuniaoGeral | null>(key);
    if (!atual) return;
    const respostas = { ...atual.respostas };
    const acoesResposta = { ...atual.acoesResposta };
    if (resposta) respostas[k] = resposta;
    else delete respostas[k];
    if (resposta && tarefaId) acoesResposta[k] = tarefaId;
    else delete acoesResposta[k];
    qc.setQueryData(key, { ...atual, respostas, acoesResposta });
  };

  /** Resposta da pauta: otimista; null apaga (Desfazer). */
  const responder = useMutation({
    mutationFn: (v: {
      reuniaoId: string;
      secao: SecaoResposta;
      itemId: string;
      resposta: RespostaReuniao | null;
      tarefaId?: string | null;
    }) => responderReuniao({ ...v, obraId }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const k = chaveResposta(v.secao, v.itemId);
      const atual = qc.getQueryData<ReuniaoGeral | null>(key);
      const antes = { resposta: atual?.respostas[k], tarefaId: atual?.acoesResposta[k] };
      trocarResposta(k, v.resposta, v.tarefaId ?? antes.tarefaId);
      return { k, antes };
    },
    // Resposta gravada junto com uma ação salva: o cancelQueries acima interrompeu a
    // recarga pedida pela ação; recarrega agora para trazer a ação nova ou remarcada.
    onSuccess: (_d, v) => {
      if (v.tarefaId) void inval();
    },
    onError: (_e, _v, ctx) => {
      if (ctx) trocarResposta(ctx.k, ctx.antes.resposta ?? null, ctx.antes.tarefaId);
      void inval();
    },
  });

  return {
    query,
    observacao,
    fechar,
    reabrir,
    salvarAcao,
    concluirAtv,
    desfazerAtv,
    marcarFeita,
    marcarProv,
    responder,
  };
}
