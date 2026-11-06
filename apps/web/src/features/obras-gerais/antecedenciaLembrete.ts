/** Antecedência padrão do lembrete (dias úteis), a mesma do NovaProvidenciaSheet. */
export const ANTECEDENCIA_LEMBRETE_PADRAO = 5;

/**
 * Antecedência digitada num lembrete: vazio vale o padrão (5); fora de 0 a 60
 * (ou não numérico) é inválido (`null`), para a tela avisar em vez de gravar 0.
 */
export function antecedenciaLembrete(texto: string): number | null {
  const t = texto.trim();
  if (!t) return ANTECEDENCIA_LEMBRETE_PADRAO;
  if (!/^\d+$/.test(t)) return null;
  const du = Number(t);
  return du > 60 ? null : du;
}
