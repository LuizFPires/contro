import type { AbaGeral } from './NavGeral';

// Aba das obras gerais nesta sessão: o app sempre abre no Hoje; dentro da sessão, a
// aba escolhida volta quando a casca remonta (ex.: depois de Pessoas e acessos).
let abaDaSessao: AbaGeral = 'hoje';

export function abaGeralDaSessao(): AbaGeral {
  return abaDaSessao;
}

export function guardarAbaGeral(aba: AbaGeral) {
  abaDaSessao = aba;
}

/**
 * Qual obra a aba Obra mostra para Coordenador e Membro: com uma obra só, ela; com mais
 * de uma, a última aberta (se ainda está entre as dele); senão nenhuma (a lista).
 */
export function obraDaAbaGeral(obras: { id: string }[], lembrada: string | null): string | null {
  if (obras.length === 1) return obras[0]!.id;
  if (lembrada && obras.some((o) => o.id === lembrada)) return lembrada;
  return null;
}
