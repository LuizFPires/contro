import { supabase } from '../../lib/supabase';
import { mensagemErroPlanejamento } from './mensagemErroPlanejamento';

async function chamar(nome: string, args: Record<string, unknown>): Promise<unknown> {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw new Error(mensagemErroPlanejamento(error));
  return data;
}

export interface SubitemNovo {
  nome: string;
  data_prevista: string | null;
}

/** Cria a fase (só quem planeja a obra). Devolve o id gerado no cliente. */
export async function adicionarFaseGeral(obraId: string, titulo: string): Promise<string> {
  const id = crypto.randomUUID();
  await chamar('adicionar_fase_geral', { p_obra_id: obraId, p_titulo: titulo, p_id: id });
  return id;
}

export async function adicionarAtividadeGeral(e: {
  obraId: string;
  faseId: string;
  nome: string;
  responsavelId: string | null;
  dataPrevista: string | null;
  subitens?: SubitemNovo[];
}): Promise<string> {
  const id = crypto.randomUUID();
  await chamar('adicionar_atividade_geral', {
    p_obra_id: e.obraId,
    p_fase_id: e.faseId,
    p_nome: e.nome,
    p_responsavel_id: e.responsavelId,
    p_data_prevista: e.dataPrevista,
    p_subitens: e.subitens ?? [],
    p_id: id,
  });
  return id;
}

export async function adicionarSubitemGeral(
  atividadeId: string,
  nome: string,
  dataPrevista: string | null,
): Promise<string> {
  const id = crypto.randomUUID();
  await chamar('adicionar_subitem_geral', {
    p_atividade_id: atividadeId,
    p_nome: nome,
    p_data_prevista: dataPrevista,
    p_id: id,
  });
  return id;
}

/** Devolve o id do evento da data (para o Desfazer), ou null se a data não mudou. */
export async function editarSubitemGeral(
  subitemId: string,
  nome: string,
  dataPrevista: string | null,
): Promise<string | null> {
  const data = await chamar('editar_subitem_geral', {
    p_subitem_id: subitemId,
    p_nome: nome,
    p_data_prevista: dataPrevista,
  });
  return (data as string | null) ?? null;
}

/**
 * Muda a data prevista. Item aberto com data não volta a "sem data" (use o Desfazer).
 * `motivo` é opcional e vai no evento de replanejamento. Devolve o id do evento da
 * data (para o Desfazer), ou null se nada mudou.
 */
export async function definirDataPrevista(
  atividadeId: string,
  data: string | null,
  motivo?: string | null,
): Promise<string | null> {
  const id = await chamar('definir_data_prevista', {
    p_atividade_id: atividadeId,
    p_data: data,
    p_motivo: motivo ?? null,
  });
  return (id as string | null) ?? null;
}

/** Desfaz a mudança de data do evento (volta data, original e replanejamentos exatamente). */
export async function desfazerDataPrevista(eventoId: string): Promise<void> {
  await chamar('desfazer_data_prevista', { p_evento_id: eventoId });
}

export async function definirResponsavelAtividade(
  atividadeId: string,
  responsavelId: string | null,
): Promise<void> {
  await chamar('definir_responsavel_atividade', {
    p_atividade_id: atividadeId,
    p_responsavel_id: responsavelId,
  });
}

/** Desfaz a troca de responsável: volta o anterior sem avisar ninguém por push. */
export async function desfazerResponsavelAtividade(
  atividadeId: string,
  responsavelId: string | null,
): Promise<void> {
  await chamar('desfazer_responsavel_atividade', {
    p_atividade_id: atividadeId,
    p_responsavel_id: responsavelId,
  });
}

export async function excluirSubitemGeral(subitemId: string): Promise<void> {
  await chamar('excluir_subitem_geral', { p_subitem_id: subitemId });
}

export async function restaurarSubitemGeral(subitemId: string): Promise<void> {
  await chamar('restaurar_subitem_geral', { p_subitem_id: subitemId });
}

export async function adicionarMembroObra(obraId: string, pessoaId: string): Promise<void> {
  await chamar('adicionar_membro_obra', { p_obra_id: obraId, p_pessoa_id: pessoaId });
}

/** Convida como membro. Devolve o id da pessoa quando a conta já existe, ou null quando fica como convite. */
export async function convidarMembroObra(
  obraId: string,
  nome: string,
  email: string,
): Promise<string | null> {
  const data = await chamar('convidar_membro_obra', {
    p_obra_id: obraId,
    p_nome: nome,
    p_email: email,
  });
  return (data as string | null) ?? null;
}

export async function removerDaObra(obraId: string, pessoaId: string): Promise<void> {
  await chamar('remover_da_obra', { p_obra_id: obraId, p_pessoa_id: pessoaId });
}

/** Nova ordem das fases da obra (lista completa, na ordem desejada). */
export async function reordenarFasesGeral(obraId: string, ids: string[]): Promise<void> {
  await chamar('reordenar_fases_geral', { p_obra_id: obraId, p_ids: ids });
}

/** Nova ordem das atividades de uma fase (só as de topo; subitens não entram). */
export async function reordenarAtividadesGeral(faseId: string, ids: string[]): Promise<void> {
  await chamar('reordenar_atividades_geral', { p_fase_id: faseId, p_ids: ids });
}
