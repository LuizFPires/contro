import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PapelGeral } from '@contro/core';
import { supabase } from '../../lib/supabase';

export interface PessoaGeral {
  id: string;
  nome: string;
  email: string;
  papel: PapelGeral;
  obraIds: string[];
}

export interface ConviteGeral {
  email: string;
  nome: string;
  papel: PapelGeral;
  obraIds: string[];
}

interface LinhaPessoa {
  id: string;
  nome: string;
  email: string;
  papel: PapelGeral;
  obra_ids: string[] | null;
}

interface LinhaConvite {
  email: string;
  nome: string;
  papel: PapelGeral;
  obra_ids: string[] | null;
}

async function carregar(): Promise<{ pessoas: PessoaGeral[]; convites: ConviteGeral[] }> {
  if (!supabase) return { pessoas: [], convites: [] };
  const [p, c] = await Promise.all([
    supabase.rpc('listar_pessoas_gerais'),
    supabase
      .from('convite_geral')
      .select('email,nome,papel,obra_ids')
      .is('usado_em', null)
      .order('nome'),
  ]);
  if (p.error) throw p.error;
  if (c.error) throw c.error;
  return {
    pessoas: ((p.data ?? []) as LinhaPessoa[]).map((x) => ({
      id: x.id,
      nome: x.nome,
      email: x.email,
      papel: x.papel,
      obraIds: x.obra_ids ?? [],
    })),
    convites: ((c.data ?? []) as LinhaConvite[]).map((x) => ({
      email: x.email,
      nome: x.nome,
      papel: x.papel,
      obraIds: x.obra_ids ?? [],
    })),
  };
}

/** Pessoas com acesso a Obras gerais e convites ainda não usados (só Administrador). */
export function usePessoasGerais(habilitado = true) {
  const query = useQuery({
    queryKey: ['pessoas-gerais'],
    enabled: Boolean(supabase) && habilitado,
    queryFn: carregar,
  });
  return {
    query,
    pessoas: query.data?.pessoas ?? [],
    convites: query.data?.convites ?? [],
  };
}

/** Funções que gravam o acesso e atualizam as listas (pessoas e contagens nas obras). */
export function useAcessoGeral() {
  const qc = useQueryClient();
  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ['pessoas-gerais'] });
    void qc.invalidateQueries({ queryKey: ['cadastros-gerais-pendentes'] });
    void qc.invalidateQueries({ queryKey: ['obras-gerais'] });
  };

  async function salvar(email: string, nome: string, papel: PapelGeral, obraIds: string[]) {
    if (!supabase) throw new Error('Supabase não configurado');
    const { error } = await supabase.rpc('salvar_acesso_geral', {
      p_email: email,
      p_nome: nome,
      p_papel: papel,
      p_obra_ids: obraIds,
    });
    atualizar();
    if (error) throw error;
  }

  async function definir(pessoaId: string, papel: PapelGeral, obraIds: string[]) {
    if (!supabase) throw new Error('Supabase não configurado');
    const { error } = await supabase.rpc('definir_acesso_geral', {
      p_pessoa_id: pessoaId,
      p_papel: papel,
      p_obra_ids: obraIds,
    });
    atualizar();
    if (error) throw error;
  }

  return { salvar, definir };
}

/** Cadastro pendente que escolheu Obras gerais ao criar a conta. */
export interface CadastroGeralPendente {
  id: string;
  nome: string;
  email: string;
  criadoEm: string;
}

const CHAVE_PENDENTES = ['cadastros-gerais-pendentes'];

/**
 * Fila de Obras gerais (só Administrador): quem criou a conta escolhendo Obras
 * gerais. Dar acesso usa `salvar` pelo e-mail; `definirFila` manda para a fila da
 * Contorno (ou traz de volta, no Desfazer).
 */
export function useCadastrosGeraisPendentes(habilitado = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: CHAVE_PENDENTES,
    enabled: Boolean(supabase) && habilitado,
    queryFn: async (): Promise<CadastroGeralPendente[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase.rpc('listar_cadastros_gerais_pendentes');
      if (error) throw error;
      return (
        (data ?? []) as { id: string; nome: string; email: string | null; criado_em: string }[]
      ).map((x) => ({ id: x.id, nome: x.nome, email: x.email ?? '', criadoEm: x.criado_em }));
    },
  });

  async function definirFila(id: string, contorno: boolean) {
    if (!supabase) throw new Error('Supabase não configurado');
    const { error } = await supabase.rpc('definir_fila_cadastro', {
      p_id: id,
      p_contorno: contorno,
    });
    void qc.invalidateQueries({ queryKey: CHAVE_PENDENTES });
    void qc.invalidateQueries({ queryKey: ['membros-pendentes'] });
    if (error) throw error;
  }

  return { query, pendentes: query.data ?? [], definirFila };
}
