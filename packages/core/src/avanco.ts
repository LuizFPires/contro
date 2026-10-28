// Avanço parcial da atividade (pedido do usuário, 28/10/2026). Na trilha, cada
// toque no anel soma 25%; na ficha, os cards 25 · 50 · 75 · Pronta. 100% é a
// conclusão de sempre (com ou sem foto). O banco guarda 0..99 em avanco_pct.

/** Passos do anel e dos cards; o último (100) conclui. */
export const PASSOS_AVANCO = [25, 50, 75, 100] as const;

/** Limita a 0..100 e arredonda (valor do banco ou do cache). */
export function normalizarAvanco(pct: number | null | undefined): number {
  if (pct == null || !Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** Toque no anel: vai ao próximo passo acima do atual (75 → 100 conclui). */
export function proximoAvancoAnel(atual: number): number {
  const a = normalizarAvanco(atual);
  return PASSOS_AVANCO.find((p) => p > a) ?? 100;
}

/**
 * Toque num card da ficha: marca aquele passo; tocar de novo no card que já está
 * marcado volta um passo (25 → 0), para corrigir um toque errado.
 */
export function avancoAoTocarCard(atual: number, card: number): number {
  const a = normalizarAvanco(atual);
  if (card === a) return Math.max(0, card - 25);
  return card;
}

/** Texto curto para a trilha ("50% feito"); vazio em 0 e em 100 (já tem status). */
export function textoAvanco(pct: number): string {
  const p = normalizarAvanco(pct);
  return p > 0 && p < 100 ? `${p}% feito` : '';
}
