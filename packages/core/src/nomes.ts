// Nomes de pessoas (cadastro e etiquetas).

const PARTICULAS = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

/** Cadastro exige nome e sobrenome: pelo menos duas palavras com letras. */
export function temNomeESobrenome(nome: string): boolean {
  return nome.trim().split(/\s+/).filter((p) => /\p{L}/u.test(p)).length >= 2;
}

/**
 * Nome curto para etiquetas: primeiro nome + inicial do sobrenome
 * ("Matheus Teófilo" → "Matheus T"; "Maria da Silva" → "Maria S").
 */
export function nomeCurto(nome: string | null | undefined): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  const resto = partes.slice(1).filter((p) => !PARTICULAS.has(p.toLowerCase()));
  if (resto.length === 0) return partes[0];
  return `${partes[0]} ${resto[0].charAt(0).toUpperCase()}`;
}
