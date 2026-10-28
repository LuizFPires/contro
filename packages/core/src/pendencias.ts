// Pendências de qualidade (SPEC §5): Pendentes x Resolvidas. As transições são
// garantidas no servidor (RPCs); estas funções são a mesma regra para o cliente.
import type { DataISO } from './calendar';

export type StatusPendencia = 'aberta' | 'em_vistoria' | 'fechada';
export type Criticidade = 'alta' | 'media' | 'baixa';

export interface Pendencia {
  id: string;
  status: StatusPendencia;
  ordem_fila: number;
  resolvida_por: string | null;
  /** Ordena a fila: alta, média, baixa (ausente = média). */
  criticidade?: Criticidade;
  /** Quando foi resolvida (ordena os Resolvidos, mais recente primeiro). */
  resolvida_em?: string | null;
}

/** Peso da criticidade na fila (menor vem antes). */
const PESO_CRITICIDADE: Record<Criticidade, number> = { alta: 0, media: 1, baixa: 2 };

/** Grupo de criticidade da lista de pendências (altas, médias, baixas). */
export const CRITICIDADES: Criticidade[] = ['alta', 'media', 'baixa'];

export interface PendenciasClassificadas<T extends Pendencia> {
  /** Abertas, das altas para as baixas; dentro da mesma criticidade, por ordem_fila. */
  pendentes: T[];
  /** Resolvidas (com a foto do depois), da mais recente para a mais antiga. */
  resolvidas: T[];
}

/**
 * Separa as pendências em Pendentes e Resolvidas (decisão do usuário, 28/10/2026:
 * sem fila, sem adiar e sem vistoria; tirou a foto do depois, está resolvida).
 * Pendentes vão por criticidade: altas no topo, médias no meio, baixas no fim.
 * 'em_vistoria' (dado antigo) conta como resolvida.
 */
export function classificarPendencias<T extends Pendencia>(
  pendencias: T[],
): PendenciasClassificadas<T> {
  const pendentes: T[] = [];
  const resolvidas: T[] = [];
  for (const p of pendencias) {
    if (p.status === 'aberta') pendentes.push(p);
    else resolvidas.push(p);
  }
  pendentes.sort(
    (a, b) =>
      PESO_CRITICIDADE[a.criticidade ?? 'media'] - PESO_CRITICIDADE[b.criticidade ?? 'media'] ||
      a.ordem_fila - b.ordem_fila,
  );
  resolvidas.sort((a, b) => (b.resolvida_em ?? '').localeCompare(a.resolvida_em ?? ''));
  return { pendentes, resolvidas };
}

/** Pendentes por criticidade, para a lista (só os grupos que têm itens). */
export function pendentesPorCriticidade<T extends Pendencia>(
  pendentes: T[],
): { criticidade: Criticidade; itens: T[] }[] {
  return CRITICIDADES.map((c) => ({
    criticidade: c,
    itens: pendentes.filter((p) => (p.criticidade ?? 'media') === c),
  })).filter((g) => g.itens.length > 0);
}

/** Próxima pendência ao deslizar para a direita: a seguinte, e da última volta à primeira. */
export function proximaPendencia(indice: number, total: number): number {
  return total > 0 ? (indice + 1) % total : 0;
}

/**
 * Topo da fila: menor `ordem_fila` − 1 (espelha `coalesce(min(ordem_fila),0)-1`
 * do servidor). Sem itens, o mínimo é 0 → topo −1.
 */
export function topoFila(ordens: number[]): number {
  return (ordens.length ? Math.min(...ordens) : 0) - 1;
}

/** "hoje", "1 dia", "4 dias": há quanto tempo (dias corridos) a pendência foi apontada. */
export function pendenteHa(apontadaEm: DataISO, hoje: DataISO): string {
  const dias = Math.max(
    0,
    Math.round(
      (Date.parse(`${hoje.slice(0, 10)}T00:00:00Z`) -
        Date.parse(`${apontadaEm.slice(0, 10)}T00:00:00Z`)) /
        86_400_000,
    ),
  );
  if (dias === 0) return 'hoje';
  return dias === 1 ? '1 dia' : `${dias} dias`;
}
