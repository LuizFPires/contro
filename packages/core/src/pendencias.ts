// Pendências de qualidade (SPEC §5). Fila, classificação e a regra de vistoria
// (regra 5: quem resolveu não vistoria). A transição é garantida no servidor
// (RPCs); estas funções são a mesma regra para o cliente derivar e desabilitar.
import type { DataISO } from './calendar';

export type StatusPendencia = 'aberta' | 'em_vistoria' | 'fechada';
export type Criticidade = 'alta' | 'media' | 'baixa';

export interface Pendencia {
  id: string;
  status: StatusPendencia;
  ordem_fila: number;
  adiada_ate: DataISO | null;
  resolvida_por: string | null;
}

/** Na fila = aberta e sem adiamento vigente (datas ISO comparam lexicograficamente). */
export function estaNaFila(p: Pick<Pendencia, 'status' | 'adiada_ate'>, hoje: DataISO): boolean {
  return p.status === 'aberta' && (p.adiada_ate === null || p.adiada_ate <= hoje);
}

export interface PendenciasClassificadas<T extends Pendencia> {
  fila: T[]; // aberta, na fila, ordenada por ordem_fila
  adiadas: T[]; // aberta, com adiada_ate futura
  emVistoria: T[];
  concluidas: T[];
}

/** Separa as pendências nas quatro listas da tela, ordenando a fila por ordem_fila. */
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
  fila.sort((a, b) => a.ordem_fila - b.ordem_fila);
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
