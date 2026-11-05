// Carga do Log e do Score. Itens limitados à janela de 90 dias: tarefas e
// pendências abertas ou fechadas desde o início da janela; obras ativas e as
// concluídas com algum item na janela; eventos dos últimos 90 dias. Rodadas:
// (1) obras; (2) itens, eventos e o cronograma das ativas num só Promise.all;
// (3) só se houver, o cronograma das concluídas com item na janela. Paginado,
// sem N+1. O cronograma (todas as atividades da obra, que as dependências
// pedem) é o mesmo de listarObras.
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  JANELA_LOG_DIAS,
  montarLog,
  obrasDoAmbiente,
  PRAZOS_PENDENCIA_PADRAO,
  type Ambiente,
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
  obrasNaJanela,
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

type Sb = NonNullable<typeof supabase>;
type AtividadeCarga = LinhaAtividadeLog & LinhaAtvCron;

/** Fases, atividades (todas: o cronograma pede) e dependências das obras dadas. */
async function cronogramaDasObras(
  sb: Sb,
  ids: string[],
): Promise<[LinhaFaseCron[], AtividadeCarga[], LinhaDependencia[]]> {
  if (ids.length === 0) return [[], [], []];
  return Promise.all([
    todasAsPaginas<LinhaFaseCron>((de, ate) =>
      sb
        .from('obra_fase')
        .select('id,obra_id,ordem,titulo,preliminar')
        .in('obra_id', ids)
        .order('id')
        .range(de, ate)
        .returns<LinhaFaseCron[]>(),
    ),
    todasAsPaginas<AtividadeCarga>((de, ate) =>
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
        .returns<AtividadeCarga[]>(),
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
  ]);
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
  // Log e Score são da Contorno nesta etapa: as obras gerais ficam de fora.
  type LinhaObra = ObraLog & { inicio: string; ambiente: Ambiente };
  const lidas = await todasAsPaginas<LinhaObra>((de, ate) =>
    sb
      .from('obra')
      .select('id,nome,inicio,status,entrega_original,ambiente')
      .in('status', ['ativa', 'concluida'])
      .eq('ambiente', 'contorno')
      .is('deleted_at', null)
      .order('id')
      .range(de, ate)
      .returns<LinhaObra[]>(),
  );
  const todas = obrasDoAmbiente(lidas, 'contorno');
  if (todas.length === 0) return vazio;
  const ids = todas.map((o) => o.id);
  const ativas = todas.filter((o) => o.status === 'ativa').map((o) => o.id);
  const concluidas = todas.filter((o) => o.status === 'concluida').map((o) => o.id);

  // 2ª rodada: tudo o mais em paralelo; cada tabela lê as próprias páginas em sequência.
  // Itens: abertos ou fechados desde `desde`. Eventos: `em >= desde` com a data pura
  // (meia-noite UTC); a borda de 3 h do fuso é aceita. As tabelas de evento não têm
  // obra_id: os de outras obras são descartados nos adaptadores.
  const [cronAtivas, tarefas, pendencias, cfgRes, evT, evP, evA, atvConcluidasNaJanela] =
    await Promise.all([
      cronogramaDasObras(sb, ativas),
      todasAsPaginas<LinhaTarefaLog>((de, ate) =>
        sb
          .from('tarefa')
          .select(
            'id,obra_id,texto,status,prazo,prazo_original,replanejamentos,feita_em,responsavel_id,' +
              'responsavel_nome,vinculo_tipo,vinculo_id,created_at,responsavel:pessoa!responsavel_id(nome)',
          )
          .in('obra_id', ids)
          .is('deleted_at', null)
          .or(`status.eq.aberta,feita_em.gte.${desde}`)
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
          .or(`status.eq.aberta,resolvida_em.gte.${desde}`)
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
      // Concluídas: só interessa saber quais têm atividade aberta ou concluída na janela.
      concluidas.length === 0
        ? Promise.resolve([] as { id: string; obra_id: string }[])
        : todasAsPaginas<{ id: string; obra_id: string }>((de, ate) =>
            sb
              .from('obra_atividade')
              .select('id,obra_id')
              .in('obra_id', concluidas)
              .is('deleted_at', null)
              .or(`concluida_em.is.null,concluida_em.gte.${desde}`)
              .order('id')
              .range(de, ate)
              .returns<{ id: string; obra_id: string }[]>(),
          ),
    ]);
  if (cfgRes.error) throw cfgRes.error;

  // Concluídas sem nenhum item na janela ficam fora antes de calcular.
  const obras = obrasNaJanela(todas, [...tarefas, ...pendencias, ...atvConcluidasNaJanela]);
  const naCarga = new Set(obras.map((o) => o.id));
  // 3ª rodada (só se houver): o cronograma das concluídas que ficaram.
  const cronConcluidas = await cronogramaDasObras(
    sb,
    obras.filter((o) => o.status === 'concluida').map((o) => o.id),
  );
  const fases = [...cronAtivas[0], ...cronConcluidas[0]];
  const atividades = [...cronAtivas[1], ...cronConcluidas[1]];
  const deps = [...cronAtivas[2], ...cronConcluidas[2]];

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
    obras: obras.map((o) => ({ id: o.id, nome: o.nome, status: o.status, inicio: o.inicio })),
    atividades,
    tarefas: tarefas.filter((t) => naCarga.has(t.obra_id)),
    pendencias: pendencias.filter((p) => naCarga.has(p.obra_id)),
    fimPrevisto,
    prazos,
    eventosTarefa: evT,
    eventosPendencia: evP,
    eventosAtividade: evA,
  };
}

function opcoesLogScore(desde: DataISO) {
  return {
    queryKey: ['log-score', desde] as const,
    enabled: Boolean(supabase),
    queryFn: () => loadDadosLogScore(desde),
    staleTime: 60_000,
  };
}

export function useDadosLogScore() {
  return useQuery(opcoesLogScore(inicioJanelaLog(hojeISO())));
}

/** Sem dados e com erro na carga: a tela diz "Sem conexão" em vez de "vazio". */
function semDadosPorErro(q: { data: unknown; isError: boolean }): boolean {
  return q.isError && q.data === undefined;
}

export function useLogDados(): {
  linhas: LinhaLog[];
  itens: ItemLog[];
  eventosPorItem: Map<string, EventoBruto[]>;
  obras: { id: string; nome: string }[];
  carregando: boolean;
  erro: boolean;
} {
  const q = useDadosLogScore();
  const dados = q.data;
  const derivados = useMemo(() => {
    if (!dados) return { linhas: [], itens: [], eventosPorItem: new Map(), obras: [] };
    const { itens, eventos, porItem } = indiceVida(dados);
    return {
      linhas: montarLog({ itens, eventos, hoje: hojeISO(), formatarData: formatarDataCurta }),
      itens,
      eventosPorItem: porItem,
      obras: dados.obras.map((o) => ({ id: o.id, nome: o.nome })),
    };
  }, [dados]);
  return { ...derivados, carregando: q.isLoading, erro: semDadosPorErro(q) };
}

interface IndiceVida {
  itens: ItemLog[];
  eventos: ReturnType<typeof eventosDoLog>;
  porId: Map<string, ItemLog>;
  porItem: Map<string, EventoBruto[]>;
}

// Um índice por resposta da consulta (o objeto `dados` muda a cada refetch).
const indices = new WeakMap<DadosLogScore, IndiceVida>();

/** Itens e eventos por id, calculados uma vez por resposta (sem montarLog). */
function indiceVida(dados: DadosLogScore): IndiceVida {
  let ix = indices.get(dados);
  if (!ix) {
    const itens = itensDoLog(dados);
    const eventos = eventosDoLog(dados);
    ix = {
      itens,
      eventos,
      porId: new Map(itens.map((i) => [i.id, i])),
      porItem: eventosPorItem(eventos),
    };
    indices.set(dados, ix);
  }
  return ix;
}

const SEM_EVENTOS: EventoBruto[] = [];

/**
 * "Vida do item" nas fichas: lê a mesma consulta do Log (em cache) e devolve só
 * o item e os eventos dele, sem montar o Log inteiro.
 */
export function useVidaDoItem(itemId: string): { item: ItemLog | null; eventos: EventoBruto[] } {
  const select = useCallback(
    (dados: DadosLogScore) => {
      const ix = indiceVida(dados);
      return { item: ix.porId.get(itemId) ?? null, eventos: ix.porItem.get(itemId) ?? SEM_EVENTOS };
    },
    [itemId],
  );
  const q = useQuery({ ...opcoesLogScore(inicioJanelaLog(hojeISO())), select });
  return q.data ?? { item: null, eventos: SEM_EVENTOS };
}

export function useScoreDados(): {
  equipe: ItemEquipe[];
  prestadores: ItemPrestador[];
  carregando: boolean;
  erro: boolean;
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
  return { ...derivados, carregando: q.isLoading, erro: semDadosPorErro(q) };
}
