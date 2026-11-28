import { supabase } from '../../lib/supabase';

export interface ObraConcluida {
  id: string;
  nome: string;
  concluida_em: string | null;
  concluida_por_nome: string | null;
}

/** Obras da Contorno marcadas como concluídas, da mais recente para a mais antiga. */
export async function listarObrasConcluidas(): Promise<ObraConcluida[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('obra')
    .select('id,nome,concluida_em,por:pessoa!concluida_por(nome)')
    .eq('ambiente', 'contorno')
    .eq('status', 'concluida')
    .is('deleted_at', null)
    .order('concluida_em', { ascending: false });
  if (error) throw error;
  return (
    (data ?? []) as unknown as {
      id: string;
      nome: string;
      concluida_em: string | null;
      por: { nome: string } | null;
    }[]
  ).map((o) => ({
    id: o.id,
    nome: o.nome,
    concluida_em: o.concluida_em,
    concluida_por_nome: o.por?.nome ?? null,
  }));
}
