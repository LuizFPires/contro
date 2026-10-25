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
    manual: true,
  });
  if (error) throw error;
}

export async function removerProvidencia(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('obra_providencia').delete().eq('id', id);
  if (error) throw error;
}

// --- Pendências (M4) ---

export interface NovaPendencia {
  titulo: string;
  local: string | null;
  criticidade: 'alta' | 'media' | 'baixa';
  atividadeId: string | null;
}

/** Envia a foto do antes e aponta a pendência. Retorna o id. */
export async function apontarPendencia(
  obraId: string,
  dados: NovaPendencia,
  file: File,
): Promise<string> {
  if (!supabase) throw new Error('Sem conexão');
  const fotoId = await enviarFoto(obraId, file);
  const { data, error } = await supabase.rpc('apontar_pendencia', {
    p_obra_id: obraId,
    p_titulo: dados.titulo,
    p_local: dados.local,
    p_criticidade: dados.criticidade,
    p_foto_antes_id: fotoId,
    p_atividade_id: dados.atividadeId,
  });
  if (error) throw error;
  return data as string;
}

/** Envia a foto de depois e manda a pendência para vistoria. */
export async function resolverPendencia(obraId: string, id: string, file: File): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const fotoId = await enviarFoto(obraId, file);
  const { error } = await supabase.rpc('resolver_pendencia', {
    p_id: id,
    p_foto_depois_id: fotoId,
  });
  if (error) throw error;
}

export async function adiarPendencia(id: string, data: string, motivo: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('adiar_pendencia', {
    p_id: id,
    p_data: data,
    p_motivo: motivo,
  });
  if (error) throw error;
}

export async function trazerPendencia(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('trazer_pendencia', { p_id: id });
  if (error) throw error;
}

export async function vistoriarPendencia(
  id: string,
  aprovado: boolean,
  motivo?: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('vistoriar_pendencia', {
    p_id: id,
    p_aprovado: aprovado,
    p_motivo: motivo ?? null,
  });
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
