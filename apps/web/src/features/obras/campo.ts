import { supabase } from '../../lib/supabase';

export async function marcarSubitem(
  id: string,
  feito: boolean,
  clientOpId?: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('marcar_subitem', {
    p_subitem_id: id,
    p_feito: feito,
    p_client_op_id: clientOpId ?? null,
  });
  if (error) throw error;
}

/** Início manual da atividade; `null` volta ao início pelo cronograma. */
export async function ajustarInicio(id: string, data: string | null): Promise<void> {
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

export async function marcarProvidencia(
  id: string,
  feito: boolean,
  clientOpId?: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('marcar_providencia', {
    p_id: id,
    p_feito: feito,
    p_client_op_id: clientOpId ?? null,
  });
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

/** Aponta a pendência com id gerado no cliente e a foto do antes já enviada. */
export async function apontarPendencia(
  obraId: string,
  pendenciaId: string,
  dados: NovaPendencia,
  fotoId: string,
  clientOpId?: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('apontar_pendencia', {
    p_id: pendenciaId,
    p_obra_id: obraId,
    p_titulo: dados.titulo,
    p_local: dados.local,
    p_criticidade: dados.criticidade,
    p_foto_antes_id: fotoId,
    p_atividade_id: dados.atividadeId,
    p_client_op_id: clientOpId ?? null,
  });
  if (error) throw error;
}

/** Manda a pendência para vistoria com a foto de depois já enviada (idempotente). */
export async function resolverPendencia(
  id: string,
  fotoId: string,
  clientOpId?: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('resolver_pendencia', {
    p_id: id,
    p_foto_depois_id: fotoId,
    p_client_op_id: clientOpId ?? null,
  });
  if (error) throw error;
}

export async function adiarPendencia(
  id: string,
  data: string,
  motivo: string,
  clientOpId?: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('adiar_pendencia', {
    p_id: id,
    p_data: data,
    p_motivo: motivo,
    p_client_op_id: clientOpId ?? null,
  });
  if (error) throw error;
}

export async function trazerPendencia(id: string, clientOpId?: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('trazer_pendencia', {
    p_id: id,
    p_client_op_id: clientOpId ?? null,
  });
  if (error) throw error;
}

export async function vistoriarPendencia(
  id: string,
  aprovado: boolean,
  motivo?: string,
  clientOpId?: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('vistoriar_pendencia', {
    p_id: id,
    p_aprovado: aprovado,
    p_motivo: motivo ?? null,
    p_client_op_id: clientOpId ?? null,
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
  observacao?: string | null;
  /** Nome digitado de quem não tem login (vale só sem responsavelId). */
  responsavelNome?: string | null;
}

export async function salvarTarefa(
  obraId: string,
  t: EntradaTarefa,
  clientOpId?: string,
): Promise<string> {
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
    p_client_op_id: clientOpId ?? null,
    p_observacao: t.observacao ?? null,
    p_responsavel_nome: t.responsavelNome ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function concluirTarefa(id: string, clientOpId?: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('concluir_tarefa', {
    p_id: id,
    p_client_op_id: clientOpId ?? null,
  });
  if (error) throw error;
}

export async function reabrirTarefa(id: string, clientOpId?: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('reabrir_tarefa', {
    p_id: id,
    p_client_op_id: clientOpId ?? null,
  });
  if (error) throw error;
}

export async function excluirTarefa(id: string, clientOpId?: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('excluir_tarefa', {
    p_id: id,
    p_client_op_id: clientOpId ?? null,
  });
  if (error) throw error;
}

export async function restaurarTarefa(id: string, clientOpId?: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('restaurar_tarefa', {
    p_id: id,
    p_client_op_id: clientOpId ?? null,
  });
  if (error) throw error;
}

/** Conclui a atividade, com a foto já enviada ou sem foto (idempotente por client_op_id). */
export async function concluirAtividade(
  atividadeId: string,
  fotoId: string | null,
  clientOpId?: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('concluir_atividade', {
    p_atividade_id: atividadeId,
    p_foto_id: fotoId,
    p_client_op_id: clientOpId ?? null,
  });
  if (error) throw error;
}

/** Anexa a foto (já enviada) a uma atividade concluída sem foto. */
export async function anexarFotoConclusao(
  atividadeId: string,
  fotoId: string,
  clientOpId?: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('anexar_foto_conclusao', {
    p_atividade_id: atividadeId,
    p_foto_id: fotoId,
    p_client_op_id: clientOpId ?? null,
  });
  if (error) throw error;
}

/** Desfaz a conclusão (só quem concluiu; nenhuma sucessora concluída). */
export async function desfazerConclusao(atividadeId: string, clientOpId?: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('desfazer_conclusao', {
    p_atividade_id: atividadeId,
    p_client_op_id: clientOpId ?? null,
  });
  if (error) throw error;
}
