import {
  agendaDoDia,
  calcularCronograma,
  cronogramaPreObra,
  dependenciasAtivas,
  estadoObra,
  previsaoEntrega,
  estadoAcao,
  contarAcoesNaJanela,
  prazoPendencia,
  PRAZOS_PENDENCIA_PADRAO,
  type PrazosPendencia,
  type AgendaObra,
  type AtividadeEntrada,
  type Cronograma,
  nomeCurto,
  prazosParaGravar,
  providenciasSemDono,
  atividadesSemDono,
  prazosParaGravarAtividades,
  type AtividadeSemDono,
  type LinhaProvidencia,
  type ProvidenciaSemDono,
} from '@contro/core';
import { supabase } from '../../lib/supabase';

export type { AtividadeSemDono, ProvidenciaSemDono } from '@contro/core';

/** Data de hoje no fuso do aparelho (UTC virava "amanhã" depois das 21h em Brasília). */
export function hojeISO(): string {
  return dataLocal(new Date());
}

/** Data (YYYY-MM-DD) de um instante, no fuso do aparelho. */
export function dataLocal(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

export interface Unidade {
  id: string;
  nome: string;
  cidade: string | null;
}

export type FaseEstado = 'concluida' | 'execucao' | 'planejada' | 'atraso';

export interface ObraResumo {
  id: string;
  nome: string;
  modelo_rotulo: string;
  inicio: string;
  faseAtual: string | null;
  /** Número da fase atual (1..n) e total de fases. */
  faseAtualN: number | null;
  nFases: number;
  atividadesAtrasadas: number;
  pct: number; // 0..1
  ritmoDias: number;
  entrega: string;
  atrasada: boolean;
  fasesEstado: FaseEstado[];
  /** Ações = tarefas + pendências abertas + providências e atividades sem dono. */
  acoesAbertas: number;
  acoesAtrasadas: number;
  acoesHoje: number;
  /** "Hoje" da tela inicial: atrasados e o que é para hoje. */
  agenda: AgendaObra;
  /** Providências pendentes sem tarefa aberta vinculada ("Sem responsável"). */
  providenciasSemDono: ProvidenciaSemDono[];
  /** Atividades de topo abertas sem tarefa aberta vinculada ("Sem responsável"). */
  atividadesSemDono: AtividadeSemDono[];
  /** Inauguração planejada (fixada na obra; sem ela, a do cronograma atual). */
  inauguracao: string | null;
  /** Entrega prevista (atrasadas terminam hoje); sem cálculo, a do cronograma. */
  entregaPrevista: string;
  /** Inauguração prevista depois da planejada (null = no prazo). */
  risco: { original: string; prevista: string; atrasoDu: number } | null;
}

interface LinhaAtv {
  id: string;
  obra_id: string;
  nome: string;
  fase_id: string;
  duracao_du: number;
  pai_id: string | null;
  em_sequencia: boolean;
  inicio_manual: string | null;
  concluida_em: string | null;
  mapa_antecedencia_du: number | null;
  avanco_pct: number;
  prestador: string | null;
  fim_previsto_calc: string | null;
}

export interface LinhaFaseCron {
  id: string;
  obra_id: string;
  ordem: number;
  preliminar: boolean;
}

export interface LinhaAtvCron {
  id: string;
  obra_id: string;
  fase_id: string;
  duracao_du: number;
  pai_id: string | null;
  em_sequencia: boolean;
  inicio_manual: string | null;
}

export interface LinhaDependencia {
  obra_id: string;
  atividade_id: string;
  predecessora_id: string;
  defasagem_du: number;
}

export interface MapasDependencia {
  preds: Map<string, string[]>;
  defas: Map<string, Record<string, number>>;
}

/** Predecessoras e defasagens por atividade, só entre atividades ativas (core). */
export function mapasDeDependencia(
  deps: LinhaDependencia[],
  ativas: Set<string>,
): MapasDependencia {
  const preds = new Map<string, string[]>();
  const defas = new Map<string, Record<string, number>>();
  // Atividade excluída: a sucessora herda as predecessoras dela (core).
  for (const d of dependenciasAtivas(deps, ativas)) {
    const a = preds.get(d.atividade_id) ?? [];
    a.push(d.predecessora_id);
    preds.set(d.atividade_id, a);
    if (d.defasagem_du)
      defas.set(d.atividade_id, {
        ...defas.get(d.atividade_id),
        [d.predecessora_id]: d.defasagem_du,
      });
  }
  return { preds, defas };
}

/**
 * Cronograma vigente de uma obra (sem a pré-obra), igual em toda tela que lista
 * obras: separa as fases preliminares e calcula pelo core.
 */
export function cronogramaDaObra<F extends LinhaFaseCron, A extends LinhaAtvCron>(
  o: { id: string; inicio: string },
  fases: F[],
  atividades: A[],
  dep: MapasDependencia,
) {
  const todasFases = fases.filter((f) => f.obra_id === o.id).sort((a, b) => a.ordem - b.ordem);
  // Pré-obra (Orçamento, Mapa de coleta) fica fora do cronograma, do % e das fases do card.
  const fasesPre = new Set(todasFases.filter((f) => f.preliminar).map((f) => f.id));
  const minhasFases = todasFases.filter((f) => !f.preliminar);
  const atvsPre = atividades.filter((a) => a.obra_id === o.id && fasesPre.has(a.fase_id));
  const minhasAtvs = atividades.filter((a) => a.obra_id === o.id && !fasesPre.has(a.fase_id));
  const entrada: AtividadeEntrada[] = minhasAtvs.map((a) => ({
    id: a.id,
    duracao_du: a.duracao_du,
    pai_id: a.pai_id,
    em_sequencia: a.em_sequencia,
    inicio_manual: a.inicio_manual,
    predecessoras: dep.preds.get(a.id),
    defasagens: dep.defas.get(a.id),
  }));

  let cron: Cronograma;
  try {
    cron = calcularCronograma({ inicio: o.inicio, atividades: entrada });
  } catch {
    cron = { itens: [], porId: {}, total: 0, entrega: o.inicio };
  }
  return { cron, entrada, todasFases, minhasFases, atvsPre, minhasAtvs };
}

export async function listarUnidades(): Promise<Unidade[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('unidade').select('id,nome,cidade').order('nome');
  return (data ?? []) as Unidade[];
}

export async function listarObras(): Promise<ObraResumo[]> {
  if (!supabase) return [];
  const hoje = hojeISO();
  const [obrasRes, fasesRes, atvsRes, depsRes, provsRes, tarefasRes, pendRes, cfgRes, liberaRes] =
    await Promise.all([
      supabase
        .from('obra')
        .select('id,nome,modelo_rotulo,inicio,entrega_original')
        .eq('status', 'ativa')
        .is('deleted_at', null),
      supabase.from('obra_fase').select('id,obra_id,ordem,titulo,preliminar').order('ordem'),
      supabase
        .from('obra_atividade')
        .select(
          'id,obra_id,nome,fase_id,duracao_du,pai_id,em_sequencia,inicio_manual,concluida_em,' +
            'mapa_antecedencia_du,avanco_pct,prestador,fim_previsto_calc',
        )
        .is('deleted_at', null),
      supabase.from('obra_dependencia').select('obra_id,atividade_id,predecessora_id,defasagem_du'),
      supabase
        .from('obra_providencia')
        .select(
          'id,obra_id,atividade_id,tipo,descricao,status,antecedencia_du,duracao_du,providenciar_ate',
        )
        .is('deleted_at', null),
      supabase
        .from('tarefa')
        .select(
          'id,obra_id,texto,prazo,status,responsavel_nome,vinculo_tipo,vinculo_id,' +
            'responsavel:pessoa!responsavel_id(nome)',
        )
        .eq('status', 'aberta')
        .is('deleted_at', null),
      supabase
        .from('pendencia')
        .select(
          'id,obra_id,titulo,criticidade,apontada_em,responsavel_id,responsavel:pessoa!responsavel_id(nome)',
        )
        .eq('status', 'aberta')
        .is('deleted_at', null),
      supabase
        .from('config_avisos')
        .select('pend_alta_du,pend_media_du,pend_baixa_du')
        .maybeSingle(),
      supabase.from('obra_mapa_libera').select('mapa_id,atividade_id'),
    ]);
  const liberaPorMapa = new Map<string, string[]>();
  for (const l of (liberaRes.data ?? []) as { mapa_id: string; atividade_id: string }[])
    liberaPorMapa.set(l.mapa_id, [...(liberaPorMapa.get(l.mapa_id) ?? []), l.atividade_id]);

  const obras = (obrasRes.data ?? []) as {
    id: string;
    nome: string;
    modelo_rotulo: string;
    inicio: string;
    entrega_original: string | null;
  }[];
  const fases = (fasesRes.data ?? []) as {
    id: string;
    obra_id: string;
    ordem: number;
    titulo: string;
    preliminar: boolean;
  }[];
  const atvs = (atvsRes.data ?? []) as unknown as LinhaAtv[];
  const deps = (depsRes.data ?? []) as LinhaDependencia[];
  const provs = (provsRes.data ?? []) as unknown as (LinhaProvidencia & {
    duracao_du: number;
  })[];

  const mapasDep = mapasDeDependencia(deps, new Set(atvs.map((a) => a.id)));
  const predsPorAtv = mapasDep.preds;
  const provPendentePorAtv = new Set<string>();
  for (const p of provs) if (p.status === 'pendente') provPendentePorAtv.add(p.atividade_id);

  const tarefas = (tarefasRes.data ?? []) as unknown as {
    id: string;
    obra_id: string;
    texto: string;
    prazo: string;
    status: 'aberta' | 'feita';
    responsavel_nome: string | null;
    vinculo_tipo: string | null;
    vinculo_id: string | null;
    responsavel: { nome: string } | null;
  }[];
  // Providência com tarefa aberta vinculada: a tarefa a representa (sem duplicar).
  const provComTarefa = new Set(
    tarefas
      .filter((t) => t.vinculo_tipo === 'providencia' && t.vinculo_id)
      .map((t) => t.vinculo_id),
  );
  // Atividade com tarefa aberta vinculada: no Hoje, a tarefa (com a pessoa) a representa.
  const atvComTarefa = new Set(
    tarefas.filter((t) => t.vinculo_tipo === 'atividade' && t.vinculo_id).map((t) => t.vinculo_id),
  );
  const cfg = cfgRes.data as {
    pend_alta_du: number;
    pend_media_du: number;
    pend_baixa_du: number;
  } | null;
  const prazos: PrazosPendencia = cfg
    ? { alta: cfg.pend_alta_du, media: cfg.pend_media_du, baixa: cfg.pend_baixa_du }
    : PRAZOS_PENDENCIA_PADRAO;
  const pendencias = (pendRes.data ?? []) as unknown as {
    id: string;
    obra_id: string;
    titulo: string;
    criticidade: 'alta' | 'media' | 'baixa';
    apontada_em: string;
    responsavel: { nome: string } | null;
  }[];
  // Ação = tarefa ou pendência aberta (mesma conta de Tarefas da equipe).
  type AcaoLinha = {
    id: string;
    texto: string;
    prazo: string;
    aberta: boolean;
    pessoa: string | null;
  };
  const acoesPorObra = new Map<string, AcaoLinha[]>();
  const somar = (obraId: string, a: AcaoLinha) =>
    acoesPorObra.set(obraId, [...(acoesPorObra.get(obraId) ?? []), a]);
  for (const t of tarefas)
    somar(t.obra_id, {
      id: t.id,
      texto: t.texto,
      prazo: t.prazo,
      aberta: t.status === 'aberta',
      pessoa: nomeCurto(t.responsavel?.nome ?? t.responsavel_nome) || null,
    });
  for (const p of pendencias)
    somar(p.obra_id, {
      id: p.id,
      texto: p.titulo,
      prazo: prazoPendencia(p.criticidade, dataLocal(new Date(p.apontada_em)), prazos),
      aberta: true,
      pessoa: nomeCurto(p.responsavel?.nome) || null,
    });

  return obras.map((o) => {
    const { cron, entrada, todasFases, minhasFases, atvsPre, minhasAtvs } = cronogramaDaObra(
      o,
      fases,
      atvs,
      mapasDep,
    );

    const concluidas = new Set(
      minhasAtvs.filter((a) => !a.pai_id && a.concluida_em).map((a) => a.id),
    );
    const provOk = new Set(
      cron.itens.filter((it) => !provPendentePorAtv.has(it.id)).map((it) => it.id),
    );
    const est = estadoObra({
      inicio: o.inicio,
      hoje,
      cronograma: cron,
      concluidas,
      provOk,
      avanco: Object.fromEntries(minhasAtvs.map((a) => [a.id, a.avanco_pct])),
    });

    // Fase atual = menor fase com atividade de topo não concluída.
    const faseDaAtv = new Map(minhasAtvs.filter((a) => !a.pai_id).map((a) => [a.id, a.fase_id]));
    let faseAtualId: string | null = null;
    for (const f of minhasFases) {
      const temAberta = cron.itens.some(
        (it) => faseDaAtv.get(it.id) === f.id && !concluidas.has(it.id),
      );
      if (temAberta) {
        faseAtualId = f.id;
        break;
      }
    }

    const minhasProvs = provs.filter((p) => p.obra_id === o.id);
    const tarefasDaObra = tarefas.filter((t) => t.obra_id === o.id);
    const atvsDaObra = atvs.filter((a) => a.obra_id === o.id);
    // Pré-obra (Orçamento, Mapa de coleta): datas para trás a partir do dia 0.
    const pre = (() => {
      try {
        return cronogramaPreObra(
          o.inicio,
          cron,
          atvsPre.map((a) => ({
            id: a.id,
            pai_id: a.pai_id,
            duracao_du: a.duracao_du,
            em_sequencia: a.em_sequencia,
            predecessoras: predsPorAtv.get(a.id),
            mapaAlvos: liberaPorMapa.get(a.id) ?? [],
            mapaAntecedenciaDu: a.mapa_antecedencia_du,
          })),
        );
      } catch {
        return {} as ReturnType<typeof cronogramaPreObra>;
      }
    })();
    // Prazo de cada atividade de topo: obra (cronograma) + pré-obra, para a regra "sem dono".
    const cronComPre = { porId: { ...cron.porId, ...pre } };
    const semDono = providenciasSemDono(
      minhasProvs,
      tarefasDaObra,
      atvsDaObra,
      cronComPre,
      o.inicio,
      o.nome,
    );
    // Grava o prazo calculado (aviso do gestor no servidor): sem esperar nem falhar.
    const gravar = prazosParaGravar(minhasProvs, cronComPre, o.inicio);
    if (gravar.length && supabase)
      void supabase
        .rpc('atualizar_prazos_providencias', { p_obra_id: o.id, p_prazos: gravar })
        .then(
          () => undefined,
          () => undefined,
        );
    const atvSemDono = atividadesSemDono(
      atvsDaObra,
      todasFases,
      cronComPre,
      tarefasDaObra,
      o.id,
      o.nome,
    );
    // Grava o fim previsto (aviso do gestor no servidor): sem esperar nem falhar.
    const gravarAtv = prazosParaGravarAtividades(atvsDaObra, cronComPre, todasFases);
    if (gravarAtv.length && supabase)
      void supabase
        .rpc('atualizar_prazos_atividades', { p_obra_id: o.id, p_prazos: gravarAtv })
        .then(
          () => undefined,
          () => undefined,
        );
    const acoesObra = acoesPorObra.get(o.id) ?? [];
    const contaEstado = (e: 'atrasada' | 'hoje') =>
      acoesObra.filter((a) => estadoAcao(a, hoje) === e).length +
      [...semDono, ...atvSemDono].filter(
        (p) => estadoAcao({ aberta: true, prazo: p.prazo }, hoje) === e,
      ).length;

    const fasesEstado: FaseEstado[] = minhasFases.map((f) => {
      const itens = cron.itens.filter((it) => faseDaAtv.get(it.id) === f.id);
      const todasConcluidas = itens.length > 0 && itens.every((it) => concluidas.has(it.id));
      const temAtraso = itens.some((it) => est.atividades[it.id]?.atrasada);
      if (todasConcluidas) return 'concluida';
      if (temAtraso) return 'atraso';
      if (f.id === faseAtualId) return 'execucao';
      return 'planejada';
    });

    return {
      id: o.id,
      nome: o.nome,
      modelo_rotulo: o.modelo_rotulo,
      inicio: o.inicio,
      faseAtual: minhasFases.find((f) => f.id === faseAtualId)?.titulo ?? null,
      faseAtualN: faseAtualId
        ? (todasFases.find((f) => f.id === faseAtualId)?.ordem ?? null)
        : null,
      nFases: minhasFases.length,
      atividadesAtrasadas: cron.itens.filter(
        (it) => faseDaAtv.has(it.id) && est.atividades[it.id]?.atrasada,
      ).length,
      pct: est.indicadores.real,
      ritmoDias: est.indicadores.ritmoDias,
      entrega: est.indicadores.entrega,
      atrasada: est.indicadores.ritmoDias <= -2,
      fasesEstado,
      // Mesma janela da lista de Tarefas: atrasadas, hoje e próximos 5 d.u.
      acoesAbertas: contarAcoesNaJanela(
        [
          ...acoesObra,
          ...[...semDono, ...atvSemDono].map((p) => ({ aberta: true, prazo: p.prazo })),
        ],
        hoje,
      ),
      acoesAtrasadas: contaEstado('atrasada'),
      acoesHoje: contaEstado('hoje'),
      providenciasSemDono: semDono,
      atividadesSemDono: atvSemDono,
      ...(() => {
        try {
          const p = previsaoEntrega({
            inicio: o.inicio,
            hoje,
            atividades: entrada,
            concluidas,
            nomes: {},
            entregaOriginal: o.entrega_original,
          });
          return {
            inauguracao: p.entregaOriginal,
            entregaPrevista: p.entregaPrevista,
            risco:
              p.atrasoDu > 0
                ? { original: p.entregaOriginal, prevista: p.entregaPrevista, atrasoDu: p.atrasoDu }
                : null,
          };
        } catch {
          return {
            inauguracao: o.entrega_original,
            entregaPrevista: est.indicadores.entrega,
            risco: null,
          };
        }
      })(),
      agenda: agendaDoDia({
        inicio: o.inicio,
        hoje,
        decorridos: est.indicadores.decorridos,
        atividades: minhasAtvs
          .filter((a) => !a.pai_id && cron.porId[a.id])
          .map((a) => ({
            id: a.id,
            nome: a.nome,
            es: cron.porId[a.id].es,
            inicio_previsto: cron.porId[a.id].inicio_previsto,
            fim_previsto: cron.porId[a.id].fim_previsto,
            concluida: Boolean(a.concluida_em),
            atrasada: Boolean(est.atividades[a.id]?.atrasada),
            comTarefa: atvComTarefa.has(a.id),
          }))
          .concat(
            (() => {
              // Pré-obra: datas calculadas acima (atrasa se passou do fim).
              return atvsPre
                .filter((a) => !a.pai_id && pre[a.id])
                .map((a) => ({
                  id: a.id,
                  nome: a.nome,
                  es: pre[a.id].es,
                  inicio_previsto: pre[a.id].inicio_previsto,
                  fim_previsto: pre[a.id].fim_previsto,
                  concluida: Boolean(a.concluida_em),
                  atrasada: !a.concluida_em && pre[a.id].fim_previsto < hoje,
                  comTarefa: atvComTarefa.has(a.id),
                  libera: (() => {
                    // Mapa: a mais cedo das atividades que libera (é ela que dita o prazo).
                    const alvo = (liberaPorMapa.get(a.id) ?? [])
                      .filter((id) => cron.porId[id])
                      .sort((x, y) => cron.porId[x].es - cron.porId[y].es)[0];
                    const nome = alvo ? minhasAtvs.find((x) => x.id === alvo)?.nome : undefined;
                    return alvo && nome
                      ? { nome, inicio: cron.porId[alvo].inicio_previsto }
                      : undefined;
                  })(),
                }));
            })(),
          ),
        providencias: minhasProvs
          .filter((p) => !provComTarefa.has(p.id))
          .map((p) => ({
            id: p.id,
            atividadeId: p.atividade_id,
            tipo: p.tipo,
            descricao: p.descricao,
            status: p.status,
            antecedenciaDu: p.antecedencia_du,
            duracaoDu: p.duracao_du,
          })),
        acoes: acoesObra,
      }),
    };
  });
}

export async function gerarObra(inicio: string, nome: string, modeloId: string): Promise<string> {
  if (!supabase) throw new Error('Sem conexão');
  const { data, error } = await supabase.rpc('gerar_obra', {
    p_unidade_id: null,
    p_inicio: inicio,
    p_nome: nome,
    p_modelo_id: modeloId,
  });
  if (error) throw error;
  return data as string;
}
