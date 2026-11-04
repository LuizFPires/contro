// Carga do Log e do Score: obras ativas e concluídas, itens (todos os status,
// sem os excluídos) e os eventos dos últimos 90 dias, em duas rodadas: as obras
// e depois o resto num só Promise.all (paginado, sem N+1). O cronograma é o
// mesmo de listarObras.
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
import { todasAsPaginas } from './paginas';
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
  const sb = supabase;

  // 1ª rodada: as obras (o resto é filtrado pelos ids delas).
  const obras = await todasAsPaginas<ObraLog & { inicio: string }>((de, ate) =>
    sb
      .from('obra')
      .select('id,nome,inicio,status,entrega_original')
      .in('status', ['ativa', 'concluida'])
      .is('deleted_at', null)
      .order('id')
      .range(de, ate)
      .returns<(ObraLog & { inicio: string })[]>(),
  );
  if (obras.length === 0) return vazio;
  const ids = obras.map((o) => o.id);

  // 2ª rodada: tudo o mais em paralelo; cada tabela lê as próprias páginas em sequência.
  // Eventos: `em >= desde` com a data pura (meia-noite UTC); a borda de 3 h do fuso é aceita.
  // As tabelas de evento não têm obra_id: os de outras obras são descartados nos adaptadores.
  const [fases, atividades, deps, tarefas, pendencias, cfgRes, evT, evP, evA] = await Promise.all([
    todasAsPaginas<LinhaFaseCron>((de, ate) =>
      sb
        .from('obra_fase')
        .select('id,obra_id,ordem,titulo,preliminar')
        .in('obra_id', ids)
        .order('id')
        .range(de, ate)
        .returns<LinhaFaseCron[]>(),
    ),
    todasAsPaginas<LinhaAtividadeLog & LinhaAtvCron>((de, ate) =>
      sb
        .from('obra_atividade')
        .select(
          'id,obra_id,nome,fase_id,duracao_du,pai_id,em_sequencia,inicio_manual,concluida_em,' +
            'mapa_antecedencia_du,avanco_pct,prestador,foto_conclusao_id,deleted_at',
        )
        .in('obra_id', ids)
        .is('deleted_at', null)
        .order('id')
        .range(de, ate)
        .returns<(LinhaAtividadeLog & LinhaAtvCron)[]>(),
    ),
    todasAsPaginas<LinhaDependencia>((de, ate) =>
      sb
        .from('obra_dependencia')
        .select('obra_id,atividade_id,predecessora_id,defasagem_du')
        .in('obra_id', ids)
        .order('atividade_id')
        .order('predecessora_id')
        .range(de, ate)
        .returns<LinhaDependencia[]>(),
    ),
    todasAsPaginas<LinhaTarefaLog>((de, ate) =>
      sb
        .from('tarefa')
        .select(
          'id,obra_id,texto,status,prazo,prazo_original,replanejamentos,feita_em,responsavel_id,' +
            'responsavel_nome,vinculo_tipo,vinculo_id,created_at,responsavel:pessoa!responsavel_id(nome)',
        )
        .in('obra_id', ids)
        .is('deleted_at', null)
        .order('id')
        .range(de, ate)
        .returns<LinhaTarefaLog[]>(),
    ),
    todasAsPaginas<LinhaPendenciaLog>((de, ate) =>
      sb
        .from('pendencia')
        .select(
          'id,obra_id,titulo,criticidade,apontada_em,resolvida_em,status,responsavel_id,' +
            'responsavel:pessoa!responsavel_id(nome)',
        )
        .in('obra_id', ids)
        .is('deleted_at', null)
        .order('id')
        .range(de, ate)
        .returns<LinhaPendenciaLog[]>(),
    ),
    sb.from('config_avisos').select('pend_alta_du,pend_media_du,pend_baixa_du').maybeSingle(),
    todasAsPaginas<LinhaEventoTarefa>((de, ate) =>
      sb
        .from('tarefa_evento')
        .select(`id,tarefa_id,tipo,por,em,antes,depois,${POR}`)
        .gte('em', desde)
        .order('em', { ascending: false })
        .order('id')
        .range(de, ate)
        .returns<LinhaEventoTarefa[]>(),
    ),
    todasAsPaginas<LinhaEventoPendencia>((de, ate) =>
      sb
        .from('pendencia_evento')
        .select(`id,pendencia_id,tipo,por,em,dados,${POR}`)
        .gte('em', desde)
        .order('em', { ascending: false })
        .order('id')
        .range(de, ate)
        .returns<LinhaEventoPendencia[]>(),
    ),
    todasAsPaginas<LinhaEventoAtividade>((de, ate) =>
      sb
        .from('obra_atividade_evento')
        .select(`id,atividade_id,tipo,por,em,antes,depois,${POR}`)
        .gte('em', desde)
        .order('em', { ascending: false })
        .order('id')
        .range(de, ate)
        .returns<LinhaEventoAtividade[]>(),
    ),
  ]);
  if (cfgRes.error) throw cfgRes.error;

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
    tarefas,
    pendencias,
    fimPrevisto,
    prazos,
    eventosTarefa: evT,
    eventosPendencia: evP,
    eventosAtividade: evA,
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
