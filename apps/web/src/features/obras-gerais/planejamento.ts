import { supabase } from '../../lib/supabase';
import { mensagemErroAcesso } from './mensagemErroAcesso';

async function chamar(nome: string, args: Record<string, unknown>): Promise<unknown> {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw new Error(mensagemErroAcesso(error));
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

export async function editarSubitemGeral(
  subitemId: string,
  nome: string,
  dataPrevista: string | null,
): Promise<void> {
  await chamar('editar_subitem_geral', {
    p_subitem_id: subitemId,
    p_nome: nome,
    p_data_prevista: dataPrevista,
  });
}

/** `data` nula limpa a data. `motivo` é opcional e vai no evento de replanejamento. */
export async function definirDataPrevista(
  atividadeId: string,
  data: string | null,
  motivo?: string | null,
): Promise<void> {
  await chamar('definir_data_prevista', {
    p_atividade_id: atividadeId,
    p_data: data,
    p_motivo: motivo ?? null,
  });
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

export async function excluirSubitemGeral(subitemId: string): Promise<void> {
  await chamar('excluir_subitem_geral', { p_subitem_id: subitemId });
}

export async function restaurarSubitemGeral(subitemId: string): Promise<void> {
  await chamar('restaurar_subitem_geral', { p_subitem_id: subitemId });
}

export async function adicionarMembroObra(obraId: string, pessoaId: string): Promise<void> {
  await chamar('adicionar_membro_obra', { p_obra_id: obraId, p_pessoa_id: pessoaId });
}

/** Convida pessoa nova como membro. Devolve o id da pessoa, ou null se já existia. */
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
