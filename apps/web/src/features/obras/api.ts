import {
  agendaDoDia,
  calcularCronograma,
  cronogramaPreObra,
  dependenciasAtivas,
  estadoObra,
  previsaoEntrega,
  tarefaAtrasada,
  type AgendaObra,
  type AtividadeEntrada,
  nomeCurto,
} from '@contro/core';
import { supabase } from '../../lib/supabase';

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
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
  tarefasAbertas: number;
  tarefasAtrasadas: number;
  /** "Hoje" da tela inicial: atrasados e o que é para hoje. */
  agenda: AgendaObra;
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
}

export async function listarUnidades(): Promise<Unidade[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('unidade').select('id,nome,cidade').order('nome');
  return (data ?? []) as Unidade[];
}

export async function listarObras(): Promise<ObraResumo[]> {
  if (!supabase) return [];
  const hoje = hojeISO();
  const [obrasRes, fasesRes, atvsRes, depsRes, provsRes, tarefasRes, liberaRes] = await Promise.all(
    [
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
            'mapa_antecedencia_du',
        )
        .is('deleted_at', null),
      supabase.from('obra_dependencia').select('obra_id,atividade_id,predecessora_id,defasagem_du'),
      supabase
        .from('obra_providencia')
        .select('id,obra_id,atividade_id,tipo,descricao,status,antecedencia_du,duracao_du'),
      supabase
        .from('tarefa')
        .select(
          'id,obra_id,texto,prazo,status,responsavel_nome,responsavel:pessoa!responsavel_id(nome)',
        )
        .eq('status', 'aberta')
        .is('deleted_at', null),
      supabase.from('obra_mapa_libera').select('mapa_id,atividade_id'),
    ],
  );
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
  const deps = (depsRes.data ?? []) as {
    obra_id: string;
    atividade_id: string;
    predecessora_id: string;
    defasagem_du: number;
  }[];
  const provs = (provsRes.data ?? []) as {
    id: string;
    obra_id: string;
    atividade_id: string;
    tipo: 'contratacao' | 'locacao' | 'compra';
    descricao: string;
    status: 'pendente' | 'feito';
    antecedencia_du: number;
    duracao_du: number;
  }[];

  const predsPorAtv = new Map<string, string[]>();
  const defasPorAtv = new Map<string, Record<string, number>>();
  // Atividade excluída: a sucessora herda as predecessoras dela (core).
  for (const d of dependenciasAtivas(deps, new Set(atvs.map((a) => a.id)))) {
    const a = predsPorAtv.get(d.atividade_id) ?? [];
    a.push(d.predecessora_id);
    predsPorAtv.set(d.atividade_id, a);
    if (d.defasagem_du)
      defasPorAtv.set(d.atividade_id, {
        ...defasPorAtv.get(d.atividade_id),
        [d.predecessora_id]: d.defasagem_du,
      });
  }
  const provPendentePorAtv = new Set<string>();
  for (const p of provs) if (p.status === 'pendente') provPendentePorAtv.add(p.atividade_id);

  const tarefas = (tarefasRes.data ?? []) as unknown as {
    id: string;
    obra_id: string;
    texto: string;
    prazo: string;
    status: 'aberta' | 'feita';
    responsavel_nome: string | null;
    responsavel: { nome: string } | null;
  }[];
  const tAbertas = new Map<string, number>();
  const tAtrasadas = new Map<string, number>();
  for (const t of tarefas) {
    tAbertas.set(t.obra_id, (tAbertas.get(t.obra_id) ?? 0) + 1);
    if (tarefaAtrasada(t, hoje)) tAtrasadas.set(t.obra_id, (tAtrasadas.get(t.obra_id) ?? 0) + 1);
  }

  return obras.map((o) => {
    const todasFases = fases.filter((f) => f.obra_id === o.id).sort((a, b) => a.ordem - b.ordem);
    // Pré-obra (Orçamento, Mapa de coleta) fica fora do cronograma, do % e das fases do card.
    const fasesPre = new Set(todasFases.filter((f) => f.preliminar).map((f) => f.id));
    const minhasFases = todasFases.filter((f) => !f.preliminar);
    const atvsPre = atvs.filter((a) => a.obra_id === o.id && fasesPre.has(a.fase_id));
    const minhasAtvs = atvs.filter((a) => a.obra_id === o.id && !fasesPre.has(a.fase_id));
    const entrada: AtividadeEntrada[] = minhasAtvs.map((a) => ({
      id: a.id,
      duracao_du: a.duracao_du,
      pai_id: a.pai_id,
      em_sequencia: a.em_sequencia,
      inicio_manual: a.inicio_manual,
      predecessoras: predsPorAtv.get(a.id),
      defasagens: defasPorAtv.get(a.id),
    }));

    let cron;
    try {
      cron = calcularCronograma({ inicio: o.inicio, atividades: entrada });
    } catch {
      cron = { itens: [], porId: {}, total: 0, entrega: o.inicio };
    }

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
      tarefasAbertas: tAbertas.get(o.id) ?? 0,
      tarefasAtrasadas: tAtrasadas.get(o.id) ?? 0,
      risco: (() => {
        try {
          const p = previsaoEntrega({
            inicio: o.inicio,
            hoje,
            atividades: entrada,
            concluidas,
            nomes: {},
            entregaOriginal: o.entrega_original,
          });
          return p.atrasoDu > 0
            ? { original: p.entregaOriginal, prevista: p.entregaPrevista, atrasoDu: p.atrasoDu }
            : null;
        } catch {
          return null;
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
          }))
          .concat(
            (() => {
              // Pré-obra: datas para trás a partir do dia 0; atrasa se passou do fim.
              const pre = cronogramaPreObra(
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
        providencias: provs
          .filter((p) => p.obra_id === o.id)
          .map((p) => ({
            id: p.id,
            atividadeId: p.atividade_id,
            tipo: p.tipo,
            descricao: p.descricao,
            status: p.status,
            antecedenciaDu: p.antecedencia_du,
            duracaoDu: p.duracao_du,
          })),
        tarefas: tarefas
          .filter((t) => t.obra_id === o.id)
          .map((t) => ({
            id: t.id,
            texto: t.texto,
            prazo: t.prazo,
            aberta: t.status === 'aberta',
            pessoa: nomeCurto(t.responsavel?.nome ?? t.responsavel_nome) || null,
          })),
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
