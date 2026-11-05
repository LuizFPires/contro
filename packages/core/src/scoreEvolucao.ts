// Evolução do Score (05/11/2026): série do score com que a pessoa ou o prestador
// fechou cada dia útil, para o gráfico do detalhe. Puro: recebe os registros já
// carregados (score_diario), o score de agora e o "hoje".
import { addDU, deslocarDU, type DataISO } from './calendar';
import type { Janela } from './score';

export interface RegistroScoreDia {
  dia: DataISO;
  score30: number | null;
  score90: number | null;
}

export interface PontoScore {
  dia: DataISO;
  score: number;
  /** Ponto de hoje: o dia ainda não fechou. */
  aberto: boolean;
}

export interface EvolucaoScore {
  /** Dias fechados em ordem, só dias úteis com score, mais o de hoje (aberto) no fim. */
  pontos: PontoScore[];
  /** Maior e menor dos dias fechados; nulos sem dia fechado. */
  maior: PontoScore | null;
  menor: PontoScore | null;
}

function ehDiaUtil(dia: DataISO): boolean {
  const d = new Date(`${dia}T00:00:00Z`).getUTCDay();
  return d >= 1 && d <= 5;
}

/** Primeiro dia útil da janela: `janela` dias corridos terminando hoje. */
function inicioDaJanela(hoje: DataISO, janela: Janela): DataISO {
  const t = Date.parse(`${hoje}T00:00:00Z`) - (janela - 1) * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Monta a série da janela (30 ou 90 dias corridos terminando hoje): um ponto por
 * dia útil fechado com score (o da mesma janela), mais o score de agora como
 * ponto aberto de hoje. Dia sem registro ou sem score fica de fora (lacuna).
 */
export function evolucaoScore(
  registros: RegistroScoreDia[],
  agora: number | null,
  hoje: DataISO,
  janela: Janela,
): EvolucaoScore {
  const inicio = inicioDaJanela(hoje, janela);
  const campo = janela === 30 ? 'score30' : 'score90';
  const porDia = new Map<DataISO, number>();
  for (const r of registros) {
    const v = r[campo];
    if (v == null || r.dia < inicio || r.dia >= hoje || !ehDiaUtil(r.dia)) continue;
    porDia.set(r.dia, v);
  }
  const fechados: PontoScore[] = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, score]) => ({ dia, score, aberto: false }));

  let maior: PontoScore | null = null;
  let menor: PontoScore | null = null;
  for (const p of fechados) {
    if (!maior || p.score >= maior.score) maior = p;
    if (!menor || p.score <= menor.score) menor = p;
  }

  const pontos =
    agora == null ? fechados : [...fechados, { dia: hoje, score: agora, aberto: true }];
  return { pontos, maior, menor };
}

/**
 * Variação do ponto em relação ao dia fechado anterior da série; nula para o
 * primeiro ponto e para o de hoje (aberto). `desdeOntem` só quando o ponto é o
 * dia útil de ontem e o anterior é o dia útil logo antes dele; `eOntem` diz se o
 * ponto é o dia útil de ontem.
 */
export function variacaoScore(
  pontos: PontoScore[],
  i: number,
  hoje: DataISO,
): { delta: number; desdeOntem: boolean; eOntem: boolean } | null {
  const p = pontos[i];
  const ant = pontos[i - 1];
  if (!p || !ant || p.aberto) return null;
  const eOntem = p.dia === deslocarDU(hoje, -1);
  return { delta: p.score - ant.score, desdeOntem: eOntem && addDU(ant.dia, 1) === p.dia, eOntem };
}
