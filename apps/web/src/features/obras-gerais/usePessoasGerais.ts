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
export function usePessoasGerais() {
  const query = useQuery({
    queryKey: ['pessoas-gerais'],
    enabled: Boolean(supabase),
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
