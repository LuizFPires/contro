import type { PapelGeral } from './ambiente';

type PerfilContorno = 'gestor' | 'equipe';

/** Papel de quem está na Contorno: o Coordenador tem perfil 'gestor' e a marca. */
export interface PapelNaContorno {
  perfil: PerfilContorno;
  coordenadorContorno: boolean;
}

/** "Gestor", "Coordenador" ou "Equipe de obra". */
export function rotuloPapelContorno(p: PapelNaContorno): string {
  if (p.perfil !== 'gestor') return 'Equipe de obra';
  return p.coordenadorContorno ? 'Coordenador' : 'Gestor';
}

export interface AlvoDesligar extends PapelNaContorno {
  id: string;
  administrador: boolean;
  papelGeral: PapelGeral | null;
}

/**
 * Quem pode desligar ou religar a pessoa em Pessoas e acessos (espelha
 * definir_membro_ativo): o Gestor, qualquer um; o Coordenador, só quem é da Equipe
 * (nunca Gestor nem Coordenador, da Contorno ou de Obras gerais); ninguém a si mesmo.
 */
export function podeDesligarNaContorno(
  ator: PapelNaContorno & { id: string },
  alvo: AlvoDesligar,
): boolean {
  if (ator.perfil !== 'gestor' || ator.id === alvo.id) return false;
  if (!ator.coordenadorContorno) return true;
  return (
    alvo.perfil !== 'gestor' &&
    !alvo.coordenadorContorno &&
    !alvo.administrador &&
    alvo.papelGeral !== 'coordenador'
  );
}
