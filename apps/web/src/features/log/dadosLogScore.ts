// Carga do Log e do Score: obras ativas e concluídas, itens (todos os status,
// sem os excluídos) e os eventos dos últimos 90 dias, numa só rodada de
// consultas (Promise.all, sem N+1). O cronograma é o mesmo de listarObras.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  JANELA_LOG_DIAS,
  montarLog,
  PRAZOS_PENDENCIA_PADRAO,
  type DataISO,
  type EventoBruto,
  type ItemEquipe,
  type ItemLog,
  type ItemPrestador,
  type LinhaLog,
  type PrazosPendencia,
} from '@contro/core';
import { supabase } from '../../lib/supabase';
import { formatarDataCurta } from '../../lib/datas';
import {
  cronogramaDaObra,
  hojeISO,
  mapasDeDependencia,
  type LinhaAtvCron,
  type LinhaDependencia,
  type LinhaFaseCron,
} from '../obras/api';
import {
  eventosDoLog,
  eventosPorItem,
  itensDoLog,
  itensEquipe,
  itensPrestador,
  type DadosLogScore,
  type LinhaAtividadeLog,
  type LinhaEventoAtividade,
  type LinhaEventoPendencia,
  type LinhaEventoTarefa,
  type LinhaPendenciaLog,
  type LinhaTarefaLog,
  type ObraLog,
} from './itensLog';

const POR = 'por_pessoa:pessoa!por(nome)';

/** Primeiro dia da janela de carga: hoje − 90 dias corridos. */
export function inicioJanelaLog(hoje: DataISO): DataISO {
  const t = Date.parse(`${hoje}T00:00:00Z`) - JANELA_LOG_DIAS * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export async function loadDadosLogScore(desde: DataISO): Promise<DadosLogScore> {
  const vazio: DadosLogScore = {
    obras: [],
    atividades: [],
    tarefas: [],
    pendencias: [],
    fimPrevisto: {},
    prazos: PRAZOS_PENDENCIA_PADRAO,
    eventosTarefa: [],
    eventosPendencia: [],
    eventosAtividade: [],
  };
  if (!supabase) return vazio;
  const [
    obrasRes,
    fasesRes,
    atvsRes,
    depsRes,
    tarefasRes,
    pendRes,
    cfgRes,
    evTRes,
    evPRes,
    evARes,
  ] = await Promise.all([
    supabase
      .from('obra')
      .select('id,nome,inicio,status,entrega_original')
      .in('status', ['ativa', 'concluida'])
      .is('deleted_at', null),
    supabase.from('obra_fase').select('id,obra_id,ordem,titulo,preliminar').order('ordem'),
    supabase
      .from('obra_atividade')
      .select(
        'id,obra_id,nome,fase_id,duracao_du,pai_id,em_sequencia,inicio_manual,concluida_em,' +
          'mapa_antecedencia_du,avanco_pct,prestador,foto_conclusao_id,deleted_at',
      )
      .is('deleted_at', null),
    supabase.from('obra_dependencia').select('obra_id,atividade_id,predecessora_id,defasagem_du'),
    supabase
      .from('tarefa')
      .select(
        'id,obra_id,texto,status,prazo,prazo_original,replanejamentos,feita_em,responsavel_id,' +
          'responsavel_nome,vinculo_tipo,vinculo_id,created_at,responsavel:pessoa!responsavel_id(nome)',
      )
      .is('deleted_at', null),
    supabase
      .from('pendencia')
      .select(
        'id,obra_id,titulo,criticidade,apontada_em,resolvida_em,status,responsavel_id,' +
          'responsavel:pessoa!responsavel_id(nome)',
      )
      .is('deleted_at', null),
    supabase.from('config_avisos').select('pend_alta_du,pend_media_du,pend_baixa_du').maybeSingle(),
    // Mais recentes primeiro: se o limite de linhas da API cortar, cortam as antigas.
    supabase
      .from('tarefa_evento')
      .select(`id,tarefa_id,tipo,por,em,antes,depois,${POR}`)
      .gte('em', desde)
      .order('em', { ascending: false }),
    supabase
      .from('pendencia_evento')
      .select(`id,pendencia_id,tipo,por,em,dados,${POR}`)
      .gte('em', desde)
      .order('em', { ascending: false }),
    supabase
      .from('obra_atividade_evento')
      .select(`id,atividade_id,tipo,por,em,antes,depois,${POR}`)
      .gte('em', desde)
      .order('em', { ascending: false }),
  ]);
  const erro = [
    obrasRes,
    fasesRes,
    atvsRes,
    depsRes,
    tarefasRes,
    pendRes,
    cfgRes,
    evTRes,
    evPRes,
    evARes,
  ]
    .map((r) => r.error)
    .find(Boolean);
  if (erro) throw erro;

  const obras = (obrasRes.data ?? []) as unknown as (ObraLog & { inicio: string })[];
  const fases = (fasesRes.data ?? []) as unknown as LinhaFaseCron[];
  const atividades = (atvsRes.data ?? []) as unknown as (LinhaAtividadeLog & LinhaAtvCron)[];
  const deps = (depsRes.data ?? []) as LinhaDependencia[];
  const cfg = cfgRes.data as {
    pend_alta_du: number;
    pend_media_du: number;
    pend_baixa_du: number;
  } | null;
  const prazos: PrazosPendencia = cfg
    ? { alta: cfg.pend_alta_du, media: cfg.pend_media_du, baixa: cfg.pend_baixa_du }
    : PRAZOS_PENDENCIA_PADRAO;

  const mapasDep = mapasDeDependencia(deps, new Set(atividades.map((a) => a.id)));
  const fimPrevisto: Record<string, DataISO> = {};
  for (const o of obras) {
    const { cron } = cronogramaDaObra(o, fases, atividades, mapasDep);
    for (const it of cron.itens) fimPrevisto[it.id] = it.fim_previsto;
  }

  return {
    obras: obras.map((o) => ({ id: o.id, nome: o.nome, status: o.status })),
    atividades,
    tarefas: (tarefasRes.data ?? []) as unknown as LinhaTarefaLog[],
    pendencias: (pendRes.data ?? []) as unknown as LinhaPendenciaLog[],
    fimPrevisto,
    prazos,
    eventosTarefa: (evTRes.data ?? []) as unknown as LinhaEventoTarefa[],
    eventosPendencia: (evPRes.data ?? []) as unknown as LinhaEventoPendencia[],
    eventosAtividade: (evARes.data ?? []) as unknown as LinhaEventoAtividade[],
  };
}

export function useDadosLogScore() {
  const desde = inicioJanelaLog(hojeISO());
  return useQuery({
    queryKey: ['log-score', desde],
    enabled: Boolean(supabase),
    queryFn: () => loadDadosLogScore(desde),
    staleTime: 60_000,
  });
}

export function useLogDados(): {
  linhas: LinhaLog[];
  itens: ItemLog[];
  eventosPorItem: Map<string, EventoBruto[]>;
  obras: { id: string; nome: string }[];
  carregando: boolean;
} {
  const q = useDadosLogScore();
  const dados = q.data;
  const derivados = useMemo(() => {
    if (!dados) return { linhas: [], itens: [], eventosPorItem: new Map(), obras: [] };
    const itens = itensDoLog(dados);
    const eventos = eventosDoLog(dados);
    return {
      linhas: montarLog({ itens, eventos, hoje: hojeISO(), formatarData: formatarDataCurta }),
      itens,
      eventosPorItem: eventosPorItem(eventos),
      obras: dados.obras.map((o) => ({ id: o.id, nome: o.nome })),
    };
  }, [dados]);
  return { ...derivados, carregando: q.isLoading };
}

export function useScoreDados(): {
  equipe: ItemEquipe[];
  prestadores: ItemPrestador[];
  carregando: boolean;
} {
  const q = useDadosLogScore();
  const dados = q.data;
  const derivados = useMemo(
    () =>
      dados
        ? { equipe: itensEquipe(dados), prestadores: itensPrestador(dados) }
        : { equipe: [], prestadores: [] },
    [dados],
  );
  return { ...derivados, carregando: q.isLoading };
}
