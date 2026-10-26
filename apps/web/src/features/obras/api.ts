import {
  calcularCronograma,
  estadoObra,
  tarefaAtrasada,
  type AtividadeEntrada,
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
}

interface LinhaAtv {
  id: string;
  obra_id: string;
  fase_id: string;
  duracao_du: number;
  pai_id: string | null;
  em_sequencia: boolean;
  inicio_manual: string | null;
  concluida_em: string | null;
}

export async function listarUnidades(): Promise<Unidade[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('unidade').select('id,nome,cidade').order('nome');
  return (data ?? []) as Unidade[];
}

export async function listarObras(): Promise<ObraResumo[]> {
  if (!supabase) return [];
  const hoje = hojeISO();
  const [obrasRes, fasesRes, atvsRes, depsRes, provsRes, tarefasRes] = await Promise.all([
    supabase
      .from('obra')
      .select('id,nome,modelo_rotulo,inicio')
      .eq('status', 'ativa')
      .is('deleted_at', null),
    supabase.from('obra_fase').select('id,obra_id,ordem,titulo').order('ordem'),
    supabase
      .from('obra_atividade')
      .select('id,obra_id,fase_id,duracao_du,pai_id,em_sequencia,inicio_manual,concluida_em')
      .is('deleted_at', null),
    supabase.from('obra_dependencia').select('obra_id,atividade_id,predecessora_id'),
    supabase.from('obra_providencia').select('obra_id,atividade_id,status'),
    supabase
      .from('tarefa')
      .select('obra_id,prazo,status')
      .eq('status', 'aberta')
      .is('deleted_at', null),
  ]);

  const obras = (obrasRes.data ?? []) as {
    id: string;
    nome: string;
    modelo_rotulo: string;
    inicio: string;
  }[];
  const fases = (fasesRes.data ?? []) as {
    id: string;
    obra_id: string;
    ordem: number;
    titulo: string;
  }[];
  const atvs = (atvsRes.data ?? []) as LinhaAtv[];
  const deps = (depsRes.data ?? []) as {
    obra_id: string;
    atividade_id: string;
    predecessora_id: string;
  }[];
  const provs = (provsRes.data ?? []) as {
    obra_id: string;
    atividade_id: string;
    status: string;
  }[];

  const predsPorAtv = new Map<string, string[]>();
  for (const d of deps) {
    const a = predsPorAtv.get(d.atividade_id) ?? [];
    a.push(d.predecessora_id);
    predsPorAtv.set(d.atividade_id, a);
  }
  const provPendentePorAtv = new Set<string>();
  for (const p of provs) if (p.status === 'pendente') provPendentePorAtv.add(p.atividade_id);

  const tarefas = (tarefasRes.data ?? []) as {
    obra_id: string;
    prazo: string;
    status: 'aberta' | 'feita';
  }[];
  const tAbertas = new Map<string, number>();
  const tAtrasadas = new Map<string, number>();
  for (const t of tarefas) {
    tAbertas.set(t.obra_id, (tAbertas.get(t.obra_id) ?? 0) + 1);
    if (tarefaAtrasada(t, hoje)) tAtrasadas.set(t.obra_id, (tAtrasadas.get(t.obra_id) ?? 0) + 1);
  }

  return obras.map((o) => {
    const minhasFases = fases.filter((f) => f.obra_id === o.id).sort((a, b) => a.ordem - b.ordem);
    const minhasAtvs = atvs.filter((a) => a.obra_id === o.id);
    const entrada: AtividadeEntrada[] = minhasAtvs.map((a) => ({
      id: a.id,
      duracao_du: a.duracao_du,
      pai_id: a.pai_id,
      em_sequencia: a.em_sequencia,
      inicio_manual: a.inicio_manual,
      predecessoras: predsPorAtv.get(a.id),
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
      predecessoras: Object.fromEntries(
        cron.itens.map((it) => [it.id, predsPorAtv.get(it.id) ?? []]),
      ),
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
      faseAtualN: faseAtualId ? minhasFases.findIndex((f) => f.id === faseAtualId) + 1 : null,
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
