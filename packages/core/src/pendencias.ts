// Pendências de qualidade (SPEC §5). Pendentes x Resolvidos e a regra de vistoria
// (regra 5: quem resolveu não vistoria). A transição é garantida no servidor
// (RPCs); estas funções são a mesma regra para o cliente derivar e desabilitar.
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
}

/** Peso da criticidade na fila (menor vem antes). */
const PESO_CRITICIDADE: Record<Criticidade, number> = { alta: 0, media: 1, baixa: 2 };

export interface PendenciasClassificadas<T extends Pendencia> {
  /** Abertas, das altas para as baixas; dentro da mesma criticidade, por ordem_fila. */
  pendentes: T[];
  /** Resolvidas esperando outra pessoa vistoriar (vêm primeiro em Resolvidos). */
  emVistoria: T[];
  /** Vistoriadas e fechadas. */
  vistoriadas: T[];
}

/**
 * Separa as pendências em Pendentes e Resolvidos (pedido do usuário, 28/10/2026:
 * sem fila e sem adiar). Resolvidos = em vistoria + vistoriadas. Pendentes vão
 * por criticidade: altas no topo, médias no meio, baixas no fim.
 */
export function classificarPendencias<T extends Pendencia>(
  pendencias: T[],
): PendenciasClassificadas<T> {
  const pendentes: T[] = [];
  const emVistoria: T[] = [];
  const vistoriadas: T[] = [];
  for (const p of pendencias) {
    if (p.status === 'fechada') vistoriadas.push(p);
    else if (p.status === 'em_vistoria') emVistoria.push(p);
    else pendentes.push(p);
  }
  pendentes.sort(
    (a, b) =>
      PESO_CRITICIDADE[a.criticidade ?? 'media'] - PESO_CRITICIDADE[b.criticidade ?? 'media'] ||
      a.ordem_fila - b.ordem_fila,
  );
  return { pendentes, emVistoria, vistoriadas };
}

/** Próxima pendência ao deslizar para a direita: a seguinte, e da última volta à primeira. */
export function proximaPendencia(indice: number, total: number): number {
  return total > 0 ? (indice + 1) % total : 0;
}

/**
 * Regra 5: só vistoria quem está em vistoria e não foi quem resolveu. Exige um
 * resolvedor conhecido: se `resolvida_por` for null (ex.: patch otimista offline
 * antes de o perfil carregar), ninguém vistoria até o servidor confirmar — assim
 * o próprio resolvedor não fecha a própria pendência na janela offline.
 */
export function podeVistoriar(
  p: Pick<Pendencia, 'status' | 'resolvida_por'>,
  pessoaId: string | null,
): boolean {
  return (
    p.status === 'em_vistoria' &&
    pessoaId !== null &&
    p.resolvida_por !== null &&
    p.resolvida_por !== pessoaId
  );
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
