import type { TipoProvidencia } from './trilha';

/** Vocabulário único para ações, lembretes, reunião e documentos. */
export const VERBO_PROVIDENCIA: Record<TipoProvidencia, string> = {
  compra: 'Comprar',
  locacao: 'Alugar',
  contratacao: 'Contratar',
};

export function textoProvidencia(tipo: string, descricao: string): string {
  const verbo = VERBO_PROVIDENCIA[tipo as TipoProvidencia] ?? 'Providenciar';
  return `${verbo} ${descricao.trim()}`.trimEnd();
}

const PREFIXO_ANTIGO =
  /^\s*(?:Destravar\s+)?(Compra|Comprar|Locação|Locacao|Alugar|Contratação|Contratacao|Contratar)\s*:\s*(\S[\s\S]*)$/i;

/**
 * Corrige só os prefixos antigos reconhecidos. Preserva a descrição e os
 * dois-pontos internos, sem reescrever instruções livres como "Conferir compra".
 * Espelhado em normalizar_texto_providencia no banco (inclusive fila offline).
 */
export function normalizarTextoProvidencia(texto: string): string {
  const partes = texto.match(PREFIXO_ANTIGO);
  if (!partes) return texto;
  const prefixo = partes[1].toLowerCase();
  const tipo = prefixo.startsWith('compra')
    ? 'compra'
    : prefixo.startsWith('loca') || prefixo === 'alugar'
      ? 'locacao'
      : 'contratacao';
  return textoProvidencia(tipo, partes[2]);
}
