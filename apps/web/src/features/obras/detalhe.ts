import {
  calcularCronograma,
  diaDaObra,
  estadoObra,
  type AtividadeCronograma,
  type AtividadeEntrada,
  type AtividadeEstado,
} from '@contro/core';
import { supabase } from '../../lib/supabase';
import { hojeISO } from './api';

export interface ObraFase {
  id: string;
  ordem: number;
  titulo: string;
}
export interface ObraProv {
  id: string;
  atividade_id: string;
  tipo: 'contratacao' | 'locacao' | 'compra';
  descricao: string;
  status: 'pendente' | 'feito';
  antecedencia_du: number;
  na_obra_em: string | null;
  manual: boolean;
}
export interface ObraAtv {
  id: string;
  fase_id: string;
  ordem: number;
  nome: string;
  duracao_du: number;
  pai_id: string | null;
  em_sequencia: boolean;
  inicio_manual: string | null;
  concluida_em: string | null;
  /** Foto da conclusão; null = concluída sem foto (ou aberta). */
  foto_conclusao_id: string | null;
  prestador: string | null;
  predecessoras: string[];
  /** Defasagem por predecessora (≤ 0 = paralelismo do plano de recuperação). */
  defasagens: Record<string, number>;
  providencias: ObraProv[];
}
export interface ObraCompleta {
  id: string;
  nome: string;
  inicio: string;
  modelo_rotulo: string;
  xp: number;
  /** Inauguração planejada, fixada na obra (null até a primeira abertura). */
  entrega_original: string | null;
  fases: ObraFase[];
  atividades: ObraAtv[]; // topo + subitens
  cron: {
    itens: AtividadeCronograma[];
    porId: Record<string, AtividadeCronograma>;
    total: number;
    entrega: string;
  };
  estados: Record<string, AtividadeEstado>;
  dia: { n: number; m: number };
  entrega: string;
  pct: number;
  previstoSexta: number;
  ritmoDias: number;
  decorridos: number;
}

export async function loadObra(id: string): Promise<ObraCompleta | null> {
  if (!supabase) return null;
  const hoje = hojeISO();
  const [oRes, fRes, aRes, dRes, pRes] = await Promise.all([
    supabase
      .from('obra')
      .select('id,nome,inicio,modelo_rotulo,xp,entrega_original')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase.from('obra_fase').select('id,ordem,titulo').eq('obra_id', id).order('ordem'),
    supabase
      .from('obra_atividade')
      .select(
        'id,fase_id,ordem,nome,duracao_du,pai_id,em_sequencia,inicio_manual,concluida_em,foto_conclusao_id,prestador',
      )
      .eq('obra_id', id)
      .is('deleted_at', null)
      .order('ordem'),
    supabase
      .from('obra_dependencia')
      .select('atividade_id,predecessora_id,defasagem_du')
      .eq('obra_id', id),
    supabase
      .from('obra_providencia')
      .select('id,atividade_id,tipo,descricao,status,antecedencia_du,na_obra_em,manual')
      .eq('obra_id', id),
  ]);

  const o = oRes.data as {
    id: string;
    nome: string;
    inicio: string;
    modelo_rotulo: string;
    xp: number;
    entrega_original: string | null;
  } | null;
  if (!o) return null;

  const predsPorAtv = new Map<string, string[]>();
  const defasPorAtv = new Map<string, Record<string, number>>();
  for (const d of (dRes.data ?? []) as {
    atividade_id: string;
    predecessora_id: string;
    defasagem_du: number;
  }[]) {
    const arr = predsPorAtv.get(d.atividade_id) ?? [];
    arr.push(d.predecessora_id);
    predsPorAtv.set(d.atividade_id, arr);
    if (d.defasagem_du)
      defasPorAtv.set(d.atividade_id, {
        ...defasPorAtv.get(d.atividade_id),
        [d.predecessora_id]: d.defasagem_du,
      });
  }
  const provPorAtv = new Map<string, ObraProv[]>();
  for (const pr of (pRes.data ?? []) as ObraProv[]) {
    const arr = provPorAtv.get(pr.atividade_id) ?? [];
    arr.push(pr);
    provPorAtv.set(pr.atividade_id, arr);
  }

  const atividades: ObraAtv[] = (
    (aRes.data ?? []) as Omit<ObraAtv, 'predecessoras' | 'providencias'>[]
  ).map((a) => ({
    ...a,
    predecessoras: predsPorAtv.get(a.id) ?? [],
    defasagens: defasPorAtv.get(a.id) ?? {},
    providencias: provPorAtv.get(a.id) ?? [],
  }));

  const entrada: AtividadeEntrada[] = atividades.map((a) => ({
    id: a.id,
    duracao_du: a.duracao_du,
    pai_id: a.pai_id,
    em_sequencia: a.em_sequencia,
    inicio_manual: a.inicio_manual,
    predecessoras: a.predecessoras,
    defasagens: a.defasagens,
  }));
  let cron;
  try {
    cron = calcularCronograma({ inicio: o.inicio, atividades: entrada });
  } catch {
    cron = { itens: [], porId: {}, total: 0, entrega: o.inicio };
  }

  const concluidas = new Set(
    atividades.filter((a) => !a.pai_id && a.concluida_em).map((a) => a.id),
  );
  const provOk = new Set(
    cron.itens
      .filter((it) => (provPorAtv.get(it.id) ?? []).every((p) => p.status === 'feito'))
      .map((it) => it.id),
  );
  const est = estadoObra({
    inicio: o.inicio,
    hoje,
    cronograma: cron,
    concluidas,
    provOk,
  });

  return {
    id: o.id,
    nome: o.nome,
    inicio: o.inicio,
    modelo_rotulo: o.modelo_rotulo,
    xp: o.xp,
    entrega_original: o.entrega_original,
    fases: (fRes.data ?? []) as ObraFase[],
    atividades,
    cron,
    estados: est.atividades,
    dia: diaDaObra(o.inicio, hoje, cron.total),
    entrega: est.indicadores.entrega,
    pct: est.indicadores.real,
    previstoSexta: est.indicadores.previstoSexta,
    ritmoDias: est.indicadores.ritmoDias,
    decorridos: est.indicadores.decorridos,
  };
}
