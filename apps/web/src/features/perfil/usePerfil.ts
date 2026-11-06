import { useQuery } from '@tanstack/react-query';
import type { PapelGeral, Perfil } from '@contro/core';
import { supabase } from '../../lib/supabase';

export interface PessoaAtual {
  id: string;
  perfil: Perfil;
  nome: string;
  /** false = cadastro pendente de aprovação do gestor. */
  ativo: boolean;
  /** Vê os dois ambientes e gere as obras gerais. */
  administrador: boolean;
  /** Participa da Contorno. */
  acessoContorno: boolean;
  /** Papel nas obras gerais (null = não participa). */
  papelGeral: PapelGeral | null;
  /** Coordenador da Contorno: perfil gestor, mas só desliga quem é da Equipe. */
  coordenadorContorno: boolean;
}

interface LinhaPessoa {
  id: string;
  perfil: Perfil;
  nome: string;
  ativo: boolean;
  administrador: boolean | null;
  acesso_contorno: boolean | null;
  papel_geral: PapelGeral | null;
  coordenador_contorno: boolean | null;
}

/** Falhas de rede/autenticação não significam cadastro pendente de aprovação. */
export async function carregarPerfil(): Promise<PessoaAtual | null> {
  if (!supabase) return null;
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const user = userData.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('pessoa')
    .select(
      'id, perfil, nome, ativo, administrador, acesso_contorno, papel_geral, coordenador_contorno',
    )
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  const p = data as LinhaPessoa | null;
  if (!p) return null;
  return {
    id: p.id,
    perfil: p.perfil,
    nome: p.nome,
    ativo: p.ativo,
    administrador: p.administrador === true,
    acessoContorno: p.acesso_contorno !== false,
    papelGeral: p.papel_geral ?? null,
    coordenadorContorno: p.coordenador_contorno === true,
  };
}

/** Perfil/nome da pessoa logada. ativo=false → aguardando aprovação do gestor. */
export function usePerfil() {
  return useQuery<PessoaAtual | null>({
    queryKey: ['perfil'],
    enabled: Boolean(supabase),
    queryFn: carregarPerfil,
  });
}
