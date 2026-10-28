// Pendências de qualidade (SPEC §5). Fila, classificação e a regra de vistoria
// (regra 5: quem resolveu não vistoria). A transição é garantida no servidor
// (RPCs); estas funções são a mesma regra para o cliente derivar e desabilitar.
import { addDU, type DataISO } from './calendar';

export type StatusPendencia = 'aberta' | 'em_vistoria' | 'fechada';
export type Criticidade = 'alta' | 'media' | 'baixa';

export interface Pendencia {
  id: string;
  status: StatusPendencia;
  ordem_fila: number;
  adiada_ate: DataISO | null;
  resolvida_por: string | null;
  /** Ordena a fila: alta, média, baixa (ausente = média). */
  criticidade?: Criticidade;
}

/** Peso da criticidade na fila (menor vem antes). */
const PESO_CRITICIDADE: Record<Criticidade, number> = { alta: 0, media: 1, baixa: 2 };

/** Na fila = aberta e sem adiamento vigente (datas ISO comparam lexicograficamente). */
export function estaNaFila(p: Pick<Pendencia, 'status' | 'adiada_ate'>, hoje: DataISO): boolean {
  return p.status === 'aberta' && (p.adiada_ate === null || p.adiada_ate <= hoje);
}

export interface PendenciasClassificadas<T extends Pendencia> {
  fila: T[]; // aberta, na fila: alta, média, baixa; dentro de cada uma, por ordem_fila
  adiadas: T[]; // aberta, com adiada_ate futura
  emVistoria: T[];
  concluidas: T[];
}

/**
 * Separa as pendências nas quatro listas da tela. A fila vai por criticidade
 * (pedido do usuário, 28/10/2026): altas no topo, médias no meio, baixas no fim;
 * dentro da mesma criticidade, por ordem_fila ("Resolver agora" e "Trazer para
 * a fila" sobem a pendência no grupo dela).
 */
export function classificarPendencias<T extends Pendencia>(
  pendencias: T[],
  hoje: DataISO,
): PendenciasClassificadas<T> {
  const fila: T[] = [];
  const adiadas: T[] = [];
  const emVistoria: T[] = [];
  const concluidas: T[] = [];
  for (const p of pendencias) {
    if (p.status === 'fechada') concluidas.push(p);
    else if (p.status === 'em_vistoria') emVistoria.push(p);
    else if (estaNaFila(p, hoje)) fila.push(p);
    else adiadas.push(p);
  }
  fila.sort(
    (a, b) =>
      PESO_CRITICIDADE[a.criticidade ?? 'media'] - PESO_CRITICIDADE[b.criticidade ?? 'media'] ||
      a.ordem_fila - b.ordem_fila,
  );
  return { fila, adiadas, emVistoria, concluidas };
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

/** Motivos de adiamento oferecidos na folha "Adiar pendência" (protótipo). */
export const MOTIVOS_ADIAMENTO = [
  'Aguardando material',
  'Aguardando outra equipe',
  'Local sem acesso',
  'Outro',
] as const;

/** Datas para adiar: os próximos 3 dias úteis e o 6º dia útil (≈ uma semana depois). */
export function opcoesAdiamento(hoje: DataISO): DataISO[] {
  return [1, 2, 3, 6].map((n) => addDU(hoje, n));
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
