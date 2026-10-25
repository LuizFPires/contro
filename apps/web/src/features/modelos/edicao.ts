import { supabase } from '../../lib/supabase';

// Edições granulares do modelo (só gestor, sob RLS + constraints/triggers).

export async function setDuracaoAtividade(id: string, duracao_du: number): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('modelo_atividade').update({ duracao_du }).eq('id', id);
  if (error) throw error;
}

export async function addDependencia(
  modeloId: string,
  atividadeId: string,
  predId: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('modelo_dependencia').insert({
    modelo_id: modeloId,
    atividade_id: atividadeId,
    predecessora_id: predId,
  });
  if (error) throw error; // trigger anti-ciclo rejeita ciclo
}

export async function removeDependencia(atividadeId: string, predId: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase
    .from('modelo_dependencia')
    .delete()
    .eq('atividade_id', atividadeId)
    .eq('predecessora_id', predId);
  if (error) throw error;
}

/** Exclui a atividade (cascata remove subitens, dependências e providências). */
export async function removeAtividade(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('modelo_atividade').delete().eq('id', id);
  if (error) throw error;
}

export async function renomearFase(id: string, titulo: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('modelo_fase').update({ titulo }).eq('id', id);
  if (error) throw error;
}

export async function criarFase(modeloId: string, titulo: string, ordem: number): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase
    .from('modelo_fase')
    .insert({ modelo_id: modeloId, titulo, ordem });
  if (error) throw error;
}
