import { supabase } from '../../lib/supabase';

export interface ObraGeral {
  id: string;
  nome: string;
  cidade: string | null;
  /** Quantas pessoas participam da obra. */
  pessoas: number;
}

interface LinhaObraGeral {
  id: string;
  nome: string;
  cidade: string | null;
  participantes: { count: number }[] | null;
}

/** Obras gerais ativas, por nome, com a contagem de pessoas (uma consulta só). */
export async function listarObrasGerais(): Promise<ObraGeral[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('obra')
    .select('id,nome,cidade,participantes:obra_participante(count)')
    .eq('ambiente', 'geral')
    .eq('status', 'ativa')
    .is('deleted_at', null)
    .order('nome');
  if (error) throw error;
  return ((data ?? []) as unknown as LinhaObraGeral[]).map((o) => ({
    id: o.id,
    nome: o.nome,
    cidade: o.cidade,
    pessoas: o.participantes?.[0]?.count ?? 0,
  }));
}

/** Cria a obra geral (só Administrador). O id vem do cliente para ser idempotente. */
export async function criarObraGeral(nome: string, cidade: string, id: string): Promise<string> {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase.rpc('criar_obra_geral', {
    p_nome: nome,
    p_cidade: cidade,
    p_id: id,
  });
  if (error) throw error;
  return data as string;
}

/** Edita nome e cidade (Gestor em qualquer obra geral; Coordenador nas dele). */
export async function editarObraGeral(id: string, nome: string, cidade: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');
  const { error } = await supabase.rpc('editar_obra_geral', {
    p_obra_id: id,
    p_nome: nome,
    p_cidade: cidade,
  });
  if (error) throw error;
}
