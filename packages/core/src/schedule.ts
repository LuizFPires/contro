// Motor de cronograma: dias úteis, subitens (vão), ordenação topológica
// (dependência entre quaisquer fases, sem ciclo), forward e backward pass.
// A regra de domínio vive só aqui; telas e pdf-service importam e não recalculam.

import { addDU, duEntre, type DataISO } from './calendar';

export interface AtividadeEntrada {
  id: string;
  /** Duração em dias úteis (≥1). Ignorada quando a atividade tem subitens. */
  duracao_du: number;
  /** Preenchido = subitem (um nível só). */
  pai_id?: string | null;
  /** Subitem: depois do irmão anterior (true) ou no início do pai (false). */
  em_sequencia?: boolean;
  /** Predecessoras (só no nível de atividade; qualquer fase). */
  predecessoras?: string[];
  /** Ajuste manual de início (feriado/imprevisto). */
  inicio_manual?: DataISO | null;
}

export interface EntradaCronograma {
  inicio: DataISO;
  atividades: AtividadeEntrada[];
}

export interface AtividadeCronograma {
  id: string;
  dur: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  folga: number;
  critico: boolean;
  inicio_previsto: DataISO;
  fim_previsto: DataISO;
}

export interface Cronograma {
  itens: AtividadeCronograma[];
  porId: Record<string, AtividadeCronograma>;
  total: number;
  entrega: DataISO;
}

export class CicloError extends Error {
  constructor(public ids: string[]) {
    super(`Ciclo de dependências entre: ${ids.join(', ')}`);
    this.name = 'CicloError';
  }
}

/** Peso da atividade para %/indicadores. Isolado (Q2): hoje = duração. */
export function peso(dur: number): number {
  return dur;
}

/** Duração derivada do vão dos subitens (sequência ou paralelo). */
export function durSubitens(subitens: AtividadeEntrada[]): number {
  let fimAnterior = 0;
  let vao = 0;
  for (const s of subitens) {
    const ini = s.em_sequencia === false ? 0 : fimAnterior;
    const fim = ini + s.duracao_du;
    vao = Math.max(vao, fim);
    fimAnterior = fim;
  }
  return vao;
}

/** Duração efetiva: vão dos subitens quando houver, senão duracao_du. */
export function durAtividade(atividade: AtividadeEntrada, subitens: AtividadeEntrada[]): number {
  return subitens.length > 0 ? durSubitens(subitens) : atividade.duracao_du;
}

interface Preparado {
  topo: AtividadeEntrada[]; // atividades de topo (sem pai), em ordem topológica
  subitensDe: Map<string, AtividadeEntrada[]>;
  dur: Map<string, number>;
}

function preparar(entrada: EntradaCronograma): Preparado {
  const subitensDe = new Map<string, AtividadeEntrada[]>();
  const topo: AtividadeEntrada[] = [];
  for (const a of entrada.atividades) {
    if (a.pai_id) {
      const arr = subitensDe.get(a.pai_id) ?? [];
      arr.push(a);
      subitensDe.set(a.pai_id, arr);
    } else {
      topo.push(a);
    }
  }

  const dur = new Map<string, number>();
  for (const a of topo) {
    dur.set(a.id, durAtividade(a, subitensDe.get(a.id) ?? []));
  }

  return { topo: ordenarTopologico(topo), subitensDe, dur };
}

/**
 * Ordena as atividades de topo topologicamente (predecessora antes da sucessora).
 * Rejeita ciclo com CicloError. Ignora predecessoras desconhecidas (defensivo).
 */
export function ordenarTopologico(atividades: AtividadeEntrada[]): AtividadeEntrada[] {
  const ids = new Set(atividades.map((a) => a.id));
  const grau = new Map<string, number>();
  const sucessoras = new Map<string, string[]>();
  for (const a of atividades) {
    grau.set(a.id, 0);
    sucessoras.set(a.id, []);
  }
  for (const a of atividades) {
    for (const p of a.predecessoras ?? []) {
      if (!ids.has(p)) continue;
      grau.set(a.id, (grau.get(a.id) ?? 0) + 1);
      sucessoras.get(p)!.push(a.id);
    }
  }

  const porId = new Map(atividades.map((a) => [a.id, a] as const));
  const fila = atividades.filter((a) => (grau.get(a.id) ?? 0) === 0).map((a) => a.id);
  const ordem: AtividadeEntrada[] = [];
  while (fila.length > 0) {
    const id = fila.shift()!;
    ordem.push(porId.get(id)!);
    for (const s of sucessoras.get(id)!) {
      grau.set(s, (grau.get(s) ?? 0) - 1);
      if (grau.get(s) === 0) fila.push(s);
    }
  }

  if (ordem.length !== atividades.length) {
    const noCiclo = atividades.filter((a) => (grau.get(a.id) ?? 0) > 0).map((a) => a.id);
    throw new CicloError(noCiclo);
  }
  return ordem;
}

/** Calcula o cronograma completo (forward + backward pass). */
export function calcularCronograma(entrada: EntradaCronograma): Cronograma {
  const { topo, dur } = preparar(entrada);

  // Forward pass (ES/EF) na ordem topológica.
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const a of topo) {
    const maxPred = Math.max(
      0,
      ...(a.predecessoras ?? []).map((p) => ef.get(p) ?? 0),
    );
    const offsetManual = a.inicio_manual ? duEntre(entrada.inicio, a.inicio_manual) : 0;
    const esA = Math.max(maxPred, offsetManual);
    es.set(a.id, esA);
    ef.set(a.id, esA + dur.get(a.id)!);
  }

  const total = Math.max(0, ...topo.map((a) => ef.get(a.id)!));

  // Sucessoras para o backward pass.
  const sucessoras = new Map<string, string[]>();
  for (const a of topo) sucessoras.set(a.id, []);
  for (const a of topo) {
    for (const p of a.predecessoras ?? []) {
      if (sucessoras.has(p)) sucessoras.get(p)!.push(a.id);
    }
  }

  // Backward pass (LF/LS) em ordem reversa.
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  for (let i = topo.length - 1; i >= 0; i--) {
    const a = topo[i];
    const succ = sucessoras.get(a.id)!;
    const lfA = succ.length > 0 ? Math.min(...succ.map((s) => ls.get(s)!)) : total;
    lf.set(a.id, lfA);
    ls.set(a.id, lfA - dur.get(a.id)!);
  }

  const itens: AtividadeCronograma[] = topo.map((a) => {
    const esA = es.get(a.id)!;
    const efA = ef.get(a.id)!;
    const lsA = ls.get(a.id)!;
    const folga = lsA - esA;
    return {
      id: a.id,
      dur: dur.get(a.id)!,
      es: esA,
      ef: efA,
      ls: lsA,
      lf: lf.get(a.id)!,
      folga,
      critico: folga === 0,
      inicio_previsto: addDU(entrada.inicio, esA),
      fim_previsto: addDU(entrada.inicio, efA - 1),
    };
  });

  const porId: Record<string, AtividadeCronograma> = {};
  for (const it of itens) porId[it.id] = it;

  return {
    itens,
    porId,
    total,
    entrega: addDU(entrada.inicio, total - 1),
  };
}
