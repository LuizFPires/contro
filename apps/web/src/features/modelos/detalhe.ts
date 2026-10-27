import { calcularCronograma, type AtividadeEntrada, type Cronograma } from '@contro/core';
import { supabase } from '../../lib/supabase';

const BASE = '2026-01-05';

export interface Fase {
  id: string;
  ordem: number;
  titulo: string;
  /** Pré-obra (antes do dia 0): só avisa, não trava nem entra no prazo. */
  preliminar: boolean;
}
export interface Providencia {
  id: string;
  atividade_id: string;
  tipo: 'contratacao' | 'locacao' | 'compra';
  descricao: string;
  antecedencia_du: number;
  /** Quantos dias úteis leva para providenciar (0: só o prazo). */
  duracao_du: number;
}
export interface AtividadeDetalhe {
  id: string;
  fase_id: string;
  ordem: number;
  nome: string;
  duracao_du: number;
  pai_id: string | null;
  em_sequencia: boolean;
  /** Pré-obra: antecedência do mapa (null = não é mapa) e as atividades que ele libera. */
  mapa_antecedencia_du: number | null;
  mapaLibera: string[];
  predecessoras: string[];
  providencias: Providencia[];
}
export interface ModeloCompleto {
  id: string;
  nome: string;
  subtitulo: string | null;
  fases: Fase[];
  atividades: AtividadeDetalhe[]; // topo + subitens
  cronograma: Cronograma;
}

export interface NovaAtividade {
  modeloId: string;
  faseId: string;
  nome: string;
  duracaoDu: number;
  subitens: { nome: string; duracao_du: number; em_sequencia: boolean }[];
  predecessoras: string[];
  providencias: { tipo: string; descricao: string; antecedencia_du: number; duracao_du: number }[];
  /** Pré-obra: atividades que libera e quantos dias úteis antes da mais cedo termina. */
  mapaLibera?: string[];
  mapaAntecedenciaDu?: number | null;
}

export async function loadModeloCompleto(id: string): Promise<ModeloCompleto | null> {
  if (!supabase) return null;
  const [mRes, fRes, aRes, dRes, pRes, lRes] = await Promise.all([
    supabase.from('modelo').select('id,nome,subtitulo').eq('id', id).maybeSingle(),
    supabase
      .from('modelo_fase')
      .select('id,ordem,titulo,preliminar')
      .eq('modelo_id', id)
      .order('ordem'),
    supabase
      .from('modelo_atividade')
      .select('id,fase_id,ordem,nome,duracao_du,pai_id,em_sequencia,mapa_antecedencia_du')
      .eq('modelo_id', id)
      .order('ordem'),
    supabase.from('modelo_dependencia').select('atividade_id,predecessora_id').eq('modelo_id', id),
    supabase
      .from('modelo_providencia')
      .select('id,atividade_id,tipo,descricao,antecedencia_du,duracao_du')
      .eq('modelo_id', id),
    supabase.from('modelo_mapa_libera').select('mapa_id,atividade_id').eq('modelo_id', id),
  ]);
  const liberaPorMapa = new Map<string, string[]>();
  for (const l of (lRes.data ?? []) as { mapa_id: string; atividade_id: string }[])
    liberaPorMapa.set(l.mapa_id, [...(liberaPorMapa.get(l.mapa_id) ?? []), l.atividade_id]);

  const m = mRes.data as { id: string; nome: string; subtitulo: string | null } | null;
  if (!m) return null;

  const predsPorAtv = new Map<string, string[]>();
  for (const d of (dRes.data ?? []) as { atividade_id: string; predecessora_id: string }[]) {
    const arr = predsPorAtv.get(d.atividade_id) ?? [];
    arr.push(d.predecessora_id);
    predsPorAtv.set(d.atividade_id, arr);
  }
  const provsPorAtv = new Map<string, Providencia[]>();
  for (const pr of (pRes.data ?? []) as Providencia[]) {
    const arr = provsPorAtv.get(pr.atividade_id) ?? [];
    arr.push(pr);
    provsPorAtv.set(pr.atividade_id, arr);
  }

  const atividades: AtividadeDetalhe[] = (
    (aRes.data ?? []) as Omit<AtividadeDetalhe, 'predecessoras' | 'providencias' | 'mapaLibera'>[]
  ).map((a) => ({
    ...a,
    mapaLibera: liberaPorMapa.get(a.id) ?? [],
    predecessoras: predsPorAtv.get(a.id) ?? [],
    providencias: provsPorAtv.get(a.id) ?? [],
  }));

  // O cronograma do modelo é o da obra: o pré-obra fica antes do dia 0.
  const fases = (fRes.data ?? []) as Fase[];
  const pre = new Set(fases.filter((f) => f.preliminar).map((f) => f.id));
  const entrada: AtividadeEntrada[] = atividades
    .filter((a) => !pre.has(a.fase_id))
    .map((a) => ({
      id: a.id,
      duracao_du: a.duracao_du,
      pai_id: a.pai_id,
      em_sequencia: a.em_sequencia,
      predecessoras: a.predecessoras,
    }));

  let cronograma: Cronograma;
  try {
    cronograma = calcularCronograma({ inicio: BASE, atividades: entrada });
  } catch {
    cronograma = { itens: [], porId: {}, total: 0, entrega: BASE };
  }

  return {
    id: m.id,
    nome: m.nome,
    subtitulo: m.subtitulo,
    fases,
    atividades,
    cronograma,
  };
}

export async function salvarAtividade(a: NovaAtividade): Promise<string> {
  if (!supabase) throw new Error('Sem conexão');
  const { data, error } = await supabase.rpc('salvar_modelo_atividade', {
    p_modelo_id: a.modeloId,
    p_fase_id: a.faseId,
    p_nome: a.nome,
    p_duracao_du: a.duracaoDu,
    p_subitens: a.subitens,
    p_predecessoras: a.predecessoras,
    p_providencias: a.providencias,
  });
  if (error) throw error;
  if (a.mapaLibera?.length) {
    const novo = data as string;
    const r = await supabase
      .from('modelo_atividade')
      .update({ mapa_antecedencia_du: a.mapaAntecedenciaDu ?? 0 })
      .eq('id', novo);
    if (r.error) throw r.error;
    const l = await supabase.from('modelo_mapa_libera').insert(
      a.mapaLibera.map((atividade_id) => ({
        modelo_id: a.modeloId,
        mapa_id: novo,
        atividade_id,
      })),
    );
    if (l.error) throw l.error;
  }
  return data as string;
}

/** Sugestões de nome de atividade (nomes já usados em qualquer modelo). */
export async function sugestoesAtividade(): Promise<string[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('modelo_atividade').select('nome').is('pai_id', null);
  const nomes = ((data ?? []) as { nome: string }[]).map((r) => r.nome);
  return [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
