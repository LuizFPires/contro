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

// --- Editar cronograma da obra (M5): duração e predecessoras da cópia ---

export async function editarDuracao(id: string, du: number): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  if (!Number.isInteger(du) || du < 1) throw new Error('Duração deve ser ≥ 1 dia útil');
  const { error } = await supabase.from('obra_atividade').update({ duracao_du: du }).eq('id', id);
  if (error) throw error;
}

export async function adicionarPredecessora(
  obraId: string,
  atividadeId: string,
  predecessoraId: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('obra_dependencia').insert({
    obra_id: obraId,
    atividade_id: atividadeId,
    predecessora_id: predecessoraId,
  });
  if (error) throw error;
}

export async function removerPredecessora(
  obraId: string,
  atividadeId: string,
  predecessoraId: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase
    .from('obra_dependencia')
    .delete()
    .eq('obra_id', obraId)
    .eq('atividade_id', atividadeId)
    .eq('predecessora_id', predecessoraId);
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

// --- Tarefas (M6) ---

export interface EntradaTarefa {
  id?: string | null;
  texto: string;
  responsavelId: string | null;
  prazo: string;
  vinculoTipo?: 'providencia' | 'atividade' | null;
  vinculoId?: string | null;
  origemTexto?: string | null;
}

export async function salvarTarefa(obraId: string, t: EntradaTarefa): Promise<string> {
  if (!supabase) throw new Error('Sem conexão');
  const { data, error } = await supabase.rpc('salvar_tarefa', {
    p_id: t.id ?? null,
    p_obra_id: obraId,
    p_texto: t.texto,
    p_responsavel_id: t.responsavelId,
    p_prazo: t.prazo,
    p_vinculo_tipo: t.vinculoTipo ?? null,
    p_vinculo_id: t.vinculoId ?? null,
    p_origem_texto: t.origemTexto ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function concluirTarefa(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('concluir_tarefa', { p_id: id });
  if (error) throw error;
}

export async function reabrirTarefa(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('reabrir_tarefa', { p_id: id });
  if (error) throw error;
}

export async function excluirTarefa(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('excluir_tarefa', { p_id: id });
  if (error) throw error;
}

export async function restaurarTarefa(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('restaurar_tarefa', { p_id: id });
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
