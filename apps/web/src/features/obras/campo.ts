import { supabase } from '../../lib/supabase';
import { enviarFoto } from './foto';

export async function marcarSubitem(id: string, feito: boolean): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('marcar_subitem', { p_subitem_id: id, p_feito: feito });
  if (error) throw error;
}

export async function ajustarInicio(id: string, data: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('ajustar_inicio', { p_atividade_id: id, p_data: data });
  if (error) throw error;
}

export async function editarPrestador(id: string, prestador: string | null): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('obra_atividade').update({ prestador }).eq('id', id);
  if (error) throw error;
}

export async function marcarProvidencia(id: string, feito: boolean): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('marcar_providencia', { p_id: id, p_feito: feito });
  if (error) throw error;
}

export async function adicionarProvidencia(
  obraId: string,
  atividadeId: string,
  tipo: 'contratacao' | 'locacao' | 'compra',
  descricao: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('obra_providencia').insert({
    obra_id: obraId,
    atividade_id: atividadeId,
    tipo,
    descricao,
    antecedencia_du: 0,
  });
  if (error) throw error;
}

export async function removerProvidencia(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('obra_providencia').delete().eq('id', id);
  if (error) throw error;
}

export interface ResultadoConclusao {
  xp: number;
  fase_fechada: boolean;
}

/** Envia a foto e conclui a atividade. */
export async function concluirComFoto(
  obraId: string,
  atividadeId: string,
  file: File,
): Promise<ResultadoConclusao> {
  if (!supabase) throw new Error('Sem conexão');
  const fotoId = await enviarFoto(obraId, file);
  const { data, error } = await supabase.rpc('concluir_atividade', {
    p_atividade_id: atividadeId,
    p_foto_id: fotoId,
  });
  if (error) throw error;
  return data as ResultadoConclusao;
}
