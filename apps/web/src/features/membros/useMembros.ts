import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface MembroPendente {
  id: string;
  nome: string;
  criadoEm: string;
}

interface Row {
  id: string;
  nome: string;
  created_at: string;
}

const KEY = ['membros-pendentes'];

/** Cadastros aguardando aprovação do gestor (pessoa ativo=false). */
export function useMembrosPendentes(ativo = true) {
  const qc = useQueryClient();

  const query = useQuery<MembroPendente[]>({
    queryKey: KEY,
    enabled: Boolean(supabase) && ativo,
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('pessoa')
        .select('id, nome, created_at')
        .eq('ativo', false)
        .eq('acesso_contorno', true)
        .is('desativado_em', null)
        .is('deleted_at', null)
        .order('created_at');
      if (error) throw error;
      return ((data ?? []) as Row[]).map((r) => ({
        id: r.id,
        nome: r.nome,
        criadoEm: r.created_at,
      }));
    },
  });

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Sem conexão');
      const { error } = await supabase.rpc('aprovar_pessoa', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['membros-todos'] });
    },
  });

  const recusar = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Sem conexão');
      const { error } = await supabase.rpc('recusar_pessoa', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['membros-todos'] });
    },
  });

  return { query, aprovar, recusar };
}

export function useTodosMembros() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['membros-todos'],
    queryFn: async () => {
      if (!supabase) throw new Error('Sem conexão');
      const { data, error } = await supabase
        .from('pessoa')
        .select('id,nome,perfil,ativo,desativado_em')
        // Pessoas e acessos da Contorno: sem quem só está nas obras gerais.
        .eq('acesso_contorno', true)
        .is('deleted_at', null)
        .order('nome');
      if (error) throw error;
      return data as {
        id: string;
        nome: string;
        perfil: string;
        ativo: boolean;
        desativado_em: string | null;
      }[];
    },
  });
  const definirAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      if (!supabase) throw new Error('Sem conexão');
      const { error } = await supabase.rpc('definir_membro_ativo', { p_id: id, p_ativo: ativo });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['membros-todos'] });
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['perfil'] });
    },
  });
  return { query, definirAtivo };
}
