export type Ambiente = 'contorno' | 'geral';
export type PapelGeral = 'coordenador' | 'membro';

export interface AcessoPessoa {
  administrador: boolean;
  acessoContorno: boolean;
  papelGeral: PapelGeral | null;
}

/** Ambientes que a pessoa enxerga, em ordem fixa. O papel define, não as obras. */
export function ambientesDaPessoa(p: AcessoPessoa): Ambiente[] {
  const r: Ambiente[] = [];
  if (p.acessoContorno) r.push('contorno');
  if (p.administrador || p.papelGeral !== null) r.push('geral');
  return r;
}

export function ambienteInicial(disponiveis: Ambiente[], ultimo: Ambiente | null): Ambiente {
  if (ultimo && disponiveis.includes(ultimo)) return ultimo;
  return disponiveis.includes('contorno') ? 'contorno' : 'geral';
}

/** Ambiente que abre o destino de um aviso (push): o do destino, se a pessoa o tem; senão fica onde está. */
export function ambienteParaDestino(
  destino: Ambiente,
  disponiveis: Ambiente[],
  atual: Ambiente,
): Ambiente {
  return disponiveis.includes(destino) ? destino : atual;
}

export function rotuloAmbiente(a: Ambiente): string {
  return a === 'contorno' ? 'Contorno' : 'Obras gerais';
}

export function rotuloPapelGeral(p: PapelGeral): string {
  return p === 'coordenador' ? 'Coordenador' : 'Membro';
}

/** Criar obra geral e Pessoas e acessos de Obras gerais: só o administrador. */
export function podeGerirObrasGerais(p: AcessoPessoa): boolean {
  return p.administrador;
}

export function obrasDoAmbiente<T extends { ambiente: Ambiente }>(obras: T[], a: Ambiente): T[] {
  return obras.filter((o) => o.ambiente === a);
}
