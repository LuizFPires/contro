import { calcularCronograma, type AtividadeEntrada } from '@obdc/core';
import { supabase } from '../../lib/supabase';

// Data base (segunda) só para o cálculo: o total em dias úteis independe dela.
const BASE = '2026-01-05';

export interface ModeloResumo {
  id: string;
  nome: string;
  subtitulo: string | null;
  ordem: number;
  dias: number; // total em dias úteis (via core)
  atividades: number; // nº de atividades de topo
}

interface LinhaAtividade {
  id: string;
  modelo_id: string;
  duracao_du: number;
  pai_id: string | null;
  em_sequencia: boolean;
}
interface LinhaDependencia {
  atividade_id: string;
  predecessora_id: string;
}

/** Lista os modelos ativos com dias (via core) e nº de atividades. Sem N+1. */
export async function listarModelos(): Promise<ModeloResumo[]> {
  if (!supabase) return [];
  const [modelosRes, atvsRes, depsRes] = await Promise.all([
    supabase.from('modelo').select('id,nome,subtitulo,ordem').order('ordem'),
    supabase.from('modelo_atividade').select('id,modelo_id,duracao_du,pai_id,em_sequencia'),
    supabase.from('modelo_dependencia').select('atividade_id,predecessora_id'),
  ]);

  const modelos = (modelosRes.data ?? []) as ModeloResumo[];
  const atvs = (atvsRes.data ?? []) as LinhaAtividade[];
  const deps = (depsRes.data ?? []) as LinhaDependencia[];

  const predsPorAtv = new Map<string, string[]>();
  for (const d of deps) {
    const arr = predsPorAtv.get(d.atividade_id) ?? [];
    arr.push(d.predecessora_id);
    predsPorAtv.set(d.atividade_id, arr);
  }

  const atvsPorModelo = new Map<string, AtividadeEntrada[]>();
  for (const a of atvs) {
    const arr = atvsPorModelo.get(a.modelo_id) ?? [];
    arr.push({
      id: a.id,
      duracao_du: a.duracao_du,
      pai_id: a.pai_id,
      em_sequencia: a.em_sequencia,
      predecessoras: predsPorAtv.get(a.id),
    });
    atvsPorModelo.set(a.modelo_id, arr);
  }

  return modelos.map((m) => {
    const lista = atvsPorModelo.get(m.id) ?? [];
    let dias = 0;
    try {
      dias = calcularCronograma({ inicio: BASE, atividades: lista }).total;
    } catch {
      dias = 0;
    }
    return {
      id: m.id,
      nome: m.nome,
      subtitulo: m.subtitulo,
      ordem: m.ordem,
      dias,
      atividades: lista.filter((a) => !a.pai_id).length,
    };
  });
}

export async function duplicarModelo(
  origem: string | null,
  nome: string,
  subtitulo: string | null,
): Promise<string> {
  if (!supabase) throw new Error('Sem conexão');
  const { data, error } = await supabase.rpc('duplicar_modelo', {
    p_origem: origem,
    p_nome: nome,
    p_subtitulo: subtitulo,
  });
  if (error) throw error;
  return data as string;
}

export async function excluirModelo(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('excluir_modelo', { p_id: id });
  if (error) throw error;
}

export async function restaurarModelo(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('modelo').update({ deleted_at: null }).eq('id', id);
  if (error) throw error;
}

export async function renomearModelo(
  id: string,
  nome: string,
  subtitulo: string | null,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('modelo').update({ nome, subtitulo }).eq('id', id);
  if (error) throw error;
}
