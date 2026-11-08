import type { ResultadoAvaliacao } from '@contro/core';
import { supabase } from '../../lib/supabase';

export interface LinhaItem {
  id: string;
  revisao_id: string;
  modelo_item_id: string;
  secao_ordem: number;
  secao: string;
  ordem: number;
  codigo: string | null;
  nome: string;
  pontos: number;
  resultado: ResultadoAvaliacao;
  reconfirmar: boolean;
  pendencia_id: string | null;
}

export interface LinhaRevisao {
  id: string;
  numero: number;
  status: 'aberta' | 'fechada';
  created_at: string;
  fechada_em: string | null;
  criador: { nome: string } | null;
  fechador: { nome: string } | null;
}

export interface LinhaOficial {
  id: string;
  data: string;
  pontos: number;
  total: number;
}

export interface DadosAvaliacao {
  revisoes: LinhaRevisao[];
  itens: LinhaItem[];
  oficial: LinhaOficial | null;
}

export interface ItemLista {
  id: string;
  secao_ordem: number;
  secao: string;
  ordem: number;
  nome: string;
}

function cliente() {
  if (!supabase) throw new Error('Sem conexão');
  return supabase;
}

const TAMANHO_PAGINA = 1000;

/** Itens de todas as revisões; o servidor limita cada resposta a 1.000 linhas. */
async function loadItens(obraId: string): Promise<LinhaItem[]> {
  const todos: LinhaItem[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await cliente()
      .from('avaliacao_item')
      .select(
        'id, revisao_id, modelo_item_id, secao_ordem, secao, ordem, codigo, nome, pontos, resultado, reconfirmar, pendencia_id',
      )
      .eq('obra_id', obraId)
      .order('id')
      .range(de, de + TAMANHO_PAGINA - 1);
    if (error) throw error;
    const pagina = (data ?? []) as LinhaItem[];
    todos.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return todos;
  }
}

export async function loadAvaliacao(obraId: string): Promise<DadosAvaliacao> {
  const [revisoes, itens, oficial] = await Promise.all([
    cliente()
      .from('avaliacao_revisao')
      .select(
        'id, numero, status, created_at, fechada_em, criador:criada_por(nome), fechador:fechada_por(nome)',
      )
      .eq('obra_id', obraId)
      .order('numero', { ascending: false }),
    loadItens(obraId),
    cliente()
      .from('avaliacao_oficial')
      .select('id, data, pontos, total')
      .eq('obra_id', obraId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (revisoes.error) throw revisoes.error;
  if (oficial.error) throw oficial.error;
  return {
    revisoes: (revisoes.data ?? []) as unknown as LinhaRevisao[],
    itens,
    oficial: (oficial.data as LinhaOficial | null) ?? null,
  };
}

async function rpc(nome: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await cliente().rpc(nome, args);
  if (error) throw error;
}

export const marcarItem = (itemId: string, resultado: 'conforme' | null, opId: string) =>
  rpc('marcar_avaliacao_item', { p_item_id: itemId, p_resultado: resultado, p_client_op_id: opId });

export const naoConforme = (
  itemId: string,
  pendenciaId: string,
  dados: { titulo: string | null; local: string | null; criticidade: string },
  fotoId: string | null,
  opId: string,
) =>
  rpc('avaliacao_nao_conforme', {
    p_item_id: itemId,
    p_pendencia_id: pendenciaId,
    p_titulo: dados.titulo,
    p_local: dados.local,
    p_criticidade: dados.criticidade,
    p_foto_antes_id: fotoId,
    p_client_op_id: opId,
  });

export const restaurarNc = (itemId: string, pendenciaId: string, opId: string) =>
  rpc('restaurar_nc_avaliacao', {
    p_item_id: itemId,
    p_pendencia_id: pendenciaId,
    p_client_op_id: opId,
  });

export const abrirRevisao = (obraId: string, refazer: boolean) =>
  rpc('abrir_avaliacao_revisao', { p_obra_id: obraId, p_refazer: refazer });

export const fecharRevisao = (id: string) => rpc('fechar_avaliacao_revisao', { p_revisao_id: id });

export const reabrirRevisao = (id: string) =>
  rpc('reabrir_avaliacao_revisao', { p_revisao_id: id });

export async function lancarOficial(
  obraId: string,
  v: { data: string; pontos: number; total: number },
): Promise<void> {
  const { error } = await cliente()
    .from('avaliacao_oficial')
    .insert({ obra_id: obraId, ...v });
  if (error) throw error;
}

export async function loadLista(): Promise<ItemLista[]> {
  const { data, error } = await cliente()
    .from('avaliacao_modelo_item')
    .select('id, secao_ordem, secao, ordem, nome')
    .is('deleted_at', null)
    .order('secao_ordem')
    .order('ordem');
  if (error) throw error;
  return (data ?? []) as ItemLista[];
}

export async function salvarItemLista(v: {
  id?: string;
  secao_ordem: number;
  secao: string;
  ordem: number;
  nome: string;
}): Promise<void> {
  const { id, ...campos } = v;
  const { error } = id
    ? await cliente().from('avaliacao_modelo_item').update(campos).eq('id', id)
    : await cliente().from('avaliacao_modelo_item').insert(campos);
  if (error) throw error;
}

export async function removerItemLista(id: string, removido: boolean): Promise<void> {
  const { error } = await cliente()
    .from('avaliacao_modelo_item')
    .update({ deleted_at: removido ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}
