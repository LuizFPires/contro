// Estados derivados da obra (SPEC 4.3/4.5). O banco guarda fatos (concluída em,
// providenciado, prazo); aqui calculamos os derivados a partir do cronograma.
import { addDU, duEntre, type DataISO } from './calendar';
import { normalizarAvanco } from './avanco';
import { peso, type Cronograma } from './schedule';

export interface AtividadeEstado {
  id: string;
  concluida: boolean;
  /**
   * Aberta para concluir. Não existe atividade bloqueada (decisão do usuário,
   * 26/10/2026): toda atividade não concluída pode ser concluída.
   */
  liberada: boolean;
  /** Tem lembrete (contratação, locação, compra) por providenciar — só aviso. */
  lembretesPendentes: boolean;
  atrasada: boolean;
}

export interface IndicadoresObra {
  decorridos: number;
  iniciada: boolean;
  real: number; // 0..1
  previstoHoje: number; // 0..1
  previstoSexta: number; // 0..1
  ritmoDias: number; // >0 à frente, <0 atrasada
  total: number;
  entrega: DataISO;
}

export interface EntradaObra {
  inicio: DataISO;
  hoje: DataISO;
  cronograma: Cronograma;
  concluidas: Set<string>;
  /** ids de atividades com TODAS as providências feitas (ou sem providências). */
  provOk: Set<string>;
  /**
   * Avanço parcial (0..100) das atividades abertas, por id. Conta no real pelo
   * peso da atividade (pedido do usuário, 28/10/2026). Ausente = 0.
   */
  avanco?: Record<string, number>;
}

export interface EstadoObra {
  atividades: Record<string, AtividadeEstado>;
  indicadores: IndicadoresObra;
}

export function estadoObra(e: EntradaObra): EstadoObra {
  const { cronograma, inicio, hoje, concluidas, provOk } = e;
  const feito = (id: string) => (concluidas.has(id) ? 1 : normalizarAvanco(e.avanco?.[id]) / 100);
  const decorridos = duEntre(inicio, hoje); // 0 se hoje <= inicio
  const iniciada = hoje >= inicio;

  const atividades: Record<string, AtividadeEstado> = {};
  for (const it of cronograma.itens) {
    const concluida = concluidas.has(it.id);
    atividades[it.id] = {
      id: it.id,
      concluida,
      liberada: !concluida,
      lembretesPendentes: !concluida && !provOk.has(it.id),
      atrasada: !concluida && iniciada && it.ef <= decorridos,
    };
  }

  const sumD = cronograma.itens.reduce((s, it) => s + peso(it.dur), 0) || 1;
  const real = cronograma.itens.reduce((s, it) => s + feito(it.id) * peso(it.dur), 0) / sumD;
  const prev = (x: number) =>
    cronograma.itens.reduce((s, it) => s + clamp((x - it.es) / it.dur, 0, 1) * peso(it.dur), 0) /
    sumD;
  const previstoHoje = prev(decorridos);
  const previstoSexta = prev(decorridos + 5);
  const ritmoDias = Math.round((real - previstoHoje) * cronograma.total);

  return {
    atividades,
    indicadores: {
      decorridos,
      iniciada,
      real,
      previstoHoje,
      previstoSexta,
      ritmoDias,
      total: cronograma.total,
      entrega: cronograma.entrega,
    },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Dia N de M (SPEC: cabeçalho "Dia N de M"). N = decorridos+1 limitado a total. */
export function diaDaObra(inicio: DataISO, hoje: DataISO, total: number): { n: number; m: number } {
  const dec = duEntre(inicio, hoje);
  return { n: Math.min(dec + 1, total), m: total };
}

/** Data de entrega por extenso-friendly (ISO). */
export function entregaObra(inicio: DataISO, total: number): DataISO {
  return addDU(inicio, total - 1);
}

// --- Conclusão de atividade: XP e fechamento de fase (espelha concluir_atividade) ---

/** XP por concluir uma atividade. */
export const XP_ATIVIDADE = 50;
/** XP extra ao fechar a última atividade de topo de uma fase. */
export const XP_FASE_FECHADA = 200;

export interface AtividadeFase {
  id: string;
  paiId: string | null;
  faseId: string;
  concluida: boolean;
}

/**
 * Fecha a fase se nenhuma OUTRA atividade de topo (sem pai) da mesma fase fica
 * em aberto. A própria atividade que está sendo concluída é desconsiderada
 * (`id !== atividadeId`), espelhando o estado pós-conclusão do servidor.
 */
export function faseFechaCom(
  atividadeId: string,
  faseId: string,
  atividades: AtividadeFase[],
): boolean {
  return !atividades.some(
    (a) => a.paiId === null && a.faseId === faseId && a.id !== atividadeId && !a.concluida,
  );
}

/**
 * XP otimista da conclusão (50, +200 ao fechar a fase). Mapa de coleta não vale
 * pontos: é só o controle de pronto ou não (espelha concluir_atividade).
 */
export function xpConclusao(faseFechada: boolean, mapaDeColeta = false): number {
  if (mapaDeColeta) return 0;
  return XP_ATIVIDADE + (faseFechada ? XP_FASE_FECHADA : 0);
}
