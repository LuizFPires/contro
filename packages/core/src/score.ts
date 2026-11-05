// Score por nome (equipe e prestadores): indicadores de 0 a 1, peso de cada um
// e o score de 0 a 100 numa janela de 30 ou 90 dias corridos terminando hoje.
// Só contam itens concluídos ou vencidos dentro da janela; abertos no prazo e
// excluídos ficam fora. Atraso medido em dias úteis (segunda a sexta, sem
// feriados). Puro: recebe os itens já carregados e o "hoje".
import { type DataISO } from './calendar';
import { atrasoDU, diaLocal } from './datas';
import { normalizarNome } from './nomes';

export type Janela = 30 | 90;
export type Faixa = 'resolutivo' | 'em_dia' | 'regular' | 'atencao' | 'sem_score';

export interface ItemEquipe {
  id: string;
  origem: 'tarefa' | 'pendencia';
  obraId: string;
  obraNome: string;
  texto: string;
  chavePessoa: string;
  nomePessoa: string;
  /** Prazo vigente. */
  prazo: DataISO;
  /** Primeiro prazo (antes de qualquer replanejamento). */
  prazoOriginal: DataISO;
  concluidaEm: string | null;
  replanejamentos: number;
  excluida: boolean;
}

export interface ItemPrestador {
  id: string;
  obraId: string;
  obraNome: string;
  texto: string;
  prestador: string;
  /** Fim previsto do cronograma vigente. */
  fimPrevisto: DataISO;
  concluidaEm: string | null;
  comFoto: boolean;
  excluida: boolean;
}

export interface IndicadoresEquipe {
  pontualidade: number | null;
  conclusaoDoDia: number | null;
  respostaAtraso: number | null;
  replanejamentos: number | null;
  pendencias: number | null;
}

export interface IndicadoresPrestador {
  noFimPrevisto: number | null;
  atrasoMedio: number | null;
  comFoto: number | null;
}

export interface LinhaScore<I> {
  chave: string;
  nome: string;
  itens: number;
  score: number | null;
  faixa: Faixa;
  indicadores: I;
  /** Os números por trás das notas, para a tela (d.u. e médias). */
  numeros: NumerosScore;
  piores: { id: string; texto: string; obraNome: string; detalhe: string }[];
}

export interface NumerosScore {
  /** Média de d.u. de atraso de todos os itens (0 para os no prazo). */
  atrasoMedioDU: number | null;
  /** Equipe: mediana de d.u. entre vencer e concluir, só dos que atrasaram. */
  respostaMedianaDU: number | null;
  /** Equipe: replanejamentos por tarefa. */
  replanejamentosMedia: number | null;
  /** Obras distintas com itens na janela. */
  obras: number;
}

export const PESOS_EQUIPE = {
  pontualidade: 35,
  conclusaoDoDia: 20,
  respostaAtraso: 20,
  replanejamentos: 15,
  pendencias: 10,
} as const;

export const PESOS_PRESTADOR = { noFimPrevisto: 45, atrasoMedio: 30, comFoto: 25 } as const;

/** Mínimo de itens na janela para ter score. */
export const MINIMO_ITENS = 5;

/** Primeiro dia da janela: hoje − (janela − 1) dias corridos. */
function inicioJanela(hoje: DataISO, janela: Janela): DataISO {
  const t = Date.parse(`${hoje}T00:00:00Z`) - (janela - 1) * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

interface Base {
  id: string;
  texto: string;
  obraNome: string;
  concluidaEm: string | null;
  excluida: boolean;
}

/** O item entra na janela? Concluído dentro dela, ou aberto e vencido com prazo dentro dela. */
function naJanela(item: Base, prazo: DataISO, inicio: DataISO, hoje: DataISO): boolean {
  if (item.excluida) return false;
  if (item.concluidaEm != null) {
    const dia = diaLocal(item.concluidaEm);
    return dia >= inicio && dia <= hoje;
  }
  return prazo < hoje && prazo >= inicio;
}

/** Dia em que o atraso é medido: conclusão (dia local) ou hoje, se aberto. */
function diaFim(item: Base, hoje: DataISO): DataISO {
  return item.concluidaEm != null ? diaLocal(item.concluidaEm) : hoje;
}

function proporcao(sim: number, total: number): number | null {
  return total === 0 ? null : sim / total;
}

function media(xs: number[]): number | null {
  return xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 === 1 ? o[m] : (o[m - 1] + o[m]) / 2;
}

function notaPorTeto(valor: number | null, teto: number): number | null {
  return valor == null ? null : Math.max(0, 1 - valor / teto);
}

/** Σ peso × nota, com o peso dos indicadores nulos redistribuído entre os demais. */
function pontuar<K extends string>(
  indicadores: Record<K, number | null>,
  pesos: Record<K, number>,
): number | null {
  let soma = 0;
  let pesoUsado = 0;
  for (const k of Object.keys(pesos) as K[]) {
    const nota = indicadores[k];
    if (nota == null) continue;
    soma += pesos[k] * nota;
    pesoUsado += pesos[k];
  }
  return pesoUsado === 0 ? null : Math.round((soma / pesoUsado) * 100);
}

/** Faixa de um score pela régua do Score: equipe "resolutivo", prestadores "em dia" de 75 para cima. */
export function faixaDoScore(score: number | null, aba: 'equipe' | 'prestadores'): Faixa {
  return faixaDo(score, aba === 'equipe' ? 'resolutivo' : 'em_dia');
}

function faixaDo(score: number | null, ok: 'resolutivo' | 'em_dia'): Faixa {
  if (score == null) return 'sem_score';
  if (score >= 75) return ok;
  if (score >= 50) return 'regular';
  return 'atencao';
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

interface Atraso<T> {
  item: T;
  du: number;
}

function piores<T extends Base>(
  atrasos: Atraso<T>[],
  extra: (item: T) => string | null,
): LinhaScore<unknown>['piores'] {
  return atrasos
    .filter((a) => a.du > 0)
    .sort((a, b) => b.du - a.du)
    .slice(0, 3)
    .map(({ item, du }) => {
      const mais = extra(item);
      return {
        id: item.id,
        texto: item.texto,
        obraNome: item.obraNome,
        detalhe: `${du} d.u. de atraso${mais ? ` · ${mais}` : ''}`,
      };
    });
}

/** Grafia mais frequente (empate: a que apareceu primeiro). */
function maisFrequente(nomes: string[]): string {
  const conta = new Map<string, number>();
  for (const n of nomes) conta.set(n, (conta.get(n) ?? 0) + 1);
  let melhor = nomes[0] ?? '';
  for (const [n, c] of conta) if (c > (conta.get(melhor) ?? 0)) melhor = n;
  return melhor;
}

function agrupar<T>(itens: T[], chave: (i: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const i of itens) {
    const k = chave(i);
    const g = grupos.get(k);
    if (g) g.push(i);
    else grupos.set(k, [i]);
  }
  return grupos;
}

function ordenar<I>(linhas: LinhaScore<I>[]): LinhaScore<I>[] {
  const porNome = (a: LinhaScore<I>, b: LinhaScore<I>) => a.nome.localeCompare(b.nome, 'pt-BR');
  return [...linhas].sort((a, b) => {
    if (a.score == null || b.score == null) {
      if (a.score == null && b.score == null) return porNome(a, b);
      return a.score == null ? 1 : -1;
    }
    return b.score - a.score || porNome(a, b);
  });
}

/**
 * Score da equipe por pessoa (tarefas e pendências com responsável). Toda pessoa
 * com alguma ação atribuída (não excluída) tem linha, mesmo sem itens no período.
 */
export function calcularScoreEquipe(
  itens: ItemEquipe[],
  janela: Janela,
  hoje: DataISO,
): LinhaScore<IndicadoresEquipe>[] {
  const inicio = inicioJanela(hoje, janela);
  const validos = itens.filter((i) => naJanela(i, i.prazoOriginal, inicio, hoje));
  const linhas: LinhaScore<IndicadoresEquipe>[] = [];

  for (const [chave, grupo] of agrupar(validos, (i) => i.chavePessoa)) {
    const atrasos = grupo.map((item) => ({
      item,
      du: atrasoDU(item.prazoOriginal, diaFim(item, hoje)),
    }));
    const pontual = (a: Atraso<ItemEquipe>) => a.item.concluidaEm != null && a.du === 0;

    // Conclusão do dia: itens cujo prazo vigente caiu na janela e já passou (ou foi concluído);
    // acerto = concluído até o prazo vigente (antes conta); aberto com prazo de hoje fica fora.
    const doDia = grupo.filter(
      (i) => i.prazo >= inicio && i.prazo <= hoje && (i.concluidaEm != null || i.prazo < hoje),
    );
    const pendencias = atrasos.filter((a) => a.item.origem === 'pendencia');
    const tarefas = grupo.filter((i) => i.origem === 'tarefa');
    const respostaMedianaDU = mediana(atrasos.filter((a) => a.du > 0).map((a) => a.du));
    const replanejamentosMedia = media(tarefas.map((t) => t.replanejamentos));

    const indicadores: IndicadoresEquipe = {
      pontualidade: proporcao(atrasos.filter(pontual).length, atrasos.length),
      conclusaoDoDia: proporcao(
        doDia.filter((i) => i.concluidaEm != null && diaLocal(i.concluidaEm) <= i.prazo).length,
        doDia.length,
      ),
      respostaAtraso: notaPorTeto(respostaMedianaDU, 5),
      replanejamentos: notaPorTeto(replanejamentosMedia, 2),
      pendencias: proporcao(pendencias.filter(pontual).length, pendencias.length),
    };
    const score = grupo.length >= MINIMO_ITENS ? pontuar(indicadores, PESOS_EQUIPE) : null;
    linhas.push({
      chave,
      nome: maisFrequente(grupo.map((i) => i.nomePessoa)),
      itens: grupo.length,
      score,
      faixa: faixaDo(score, 'resolutivo'),
      indicadores,
      numeros: {
        atrasoMedioDU: media(atrasos.map((a) => a.du)),
        respostaMedianaDU,
        replanejamentosMedia,
        obras: new Set(grupo.map((i) => i.obraId)).size,
      },
      piores: piores(atrasos, (i) =>
        i.origem === 'tarefa' && i.replanejamentos > 0
          ? plural(i.replanejamentos, 'replanejamento', 'replanejamentos')
          : null,
      ),
    });
  }

  // Quem tem ação atribuída mas nada concluído ou vencido no período (só abertas
  // no prazo, ou itens fora da janela) também aparece: 0 itens, sem score ainda.
  const comLinha = new Set(linhas.map((l) => l.chave));
  for (const [chave, grupo] of agrupar(
    itens.filter((i) => !i.excluida),
    (i) => i.chavePessoa,
  )) {
    if (comLinha.has(chave)) continue;
    linhas.push({
      chave,
      nome: maisFrequente(grupo.map((i) => i.nomePessoa)),
      itens: 0,
      score: null,
      faixa: 'sem_score',
      indicadores: {
        pontualidade: null,
        conclusaoDoDia: null,
        respostaAtraso: null,
        replanejamentos: null,
        pendencias: null,
      },
      numeros: {
        atrasoMedioDU: null,
        respostaMedianaDU: null,
        replanejamentosMedia: null,
        obras: 0,
      },
      piores: [],
    });
  }
  return ordenar(linhas);
}

/** Score dos prestadores por nome normalizado (atividades de topo). */
export function calcularScorePrestadores(
  itens: ItemPrestador[],
  janela: Janela,
  hoje: DataISO,
): LinhaScore<IndicadoresPrestador>[] {
  const inicio = inicioJanela(hoje, janela);
  const validos = itens.filter(
    (i) => normalizarNome(i.prestador) !== '' && naJanela(i, i.fimPrevisto, inicio, hoje),
  );
  const linhas: LinhaScore<IndicadoresPrestador>[] = [];

  for (const [chave, grupo] of agrupar(validos, (i) => normalizarNome(i.prestador))) {
    const atrasos = grupo.map((item) => ({
      item,
      du: atrasoDU(item.fimPrevisto, diaFim(item, hoje)),
    }));
    const concluidas = grupo.filter((i) => i.concluidaEm != null);
    const atrasoMedioDU = media(atrasos.map((a) => a.du));

    const indicadores: IndicadoresPrestador = {
      noFimPrevisto: proporcao(
        atrasos.filter((a) => a.item.concluidaEm != null && a.du === 0).length,
        atrasos.length,
      ),
      atrasoMedio: notaPorTeto(atrasoMedioDU, 5),
      comFoto: proporcao(concluidas.filter((i) => i.comFoto).length, concluidas.length),
    };
    const score = grupo.length >= MINIMO_ITENS ? pontuar(indicadores, PESOS_PRESTADOR) : null;
    linhas.push({
      chave,
      nome: maisFrequente(grupo.map((i) => i.prestador.trim().replace(/\s+/g, ' '))),
      itens: grupo.length,
      score,
      faixa: faixaDo(score, 'em_dia'),
      indicadores,
      numeros: {
        atrasoMedioDU,
        respostaMedianaDU: null,
        replanejamentosMedia: null,
        obras: new Set(grupo.map((i) => i.obraId)).size,
      },
      piores: piores(atrasos, () => null),
    });
  }
  return ordenar(linhas);
}

/** Score de 30 dias contra o de 90: diferença de 5 pontos ou mais muda a tendência. */
export function tendencia(
  score30: number | null,
  score90: number | null,
): 'melhorando' | 'estavel' | 'piorando' | null {
  if (score30 == null || score90 == null) return null;
  const diff = score30 - score90;
  if (diff >= 5) return 'melhorando';
  if (diff <= -5) return 'piorando';
  return 'estavel';
}

/** Rótulo em pt-BR da faixa ("Resolutiva" para pessoa no feminino). */
export function rotuloFaixa(f: Faixa, genero?: 'f' | 'm'): string {
  switch (f) {
    case 'resolutivo':
      return genero === 'f' ? 'Resolutiva' : 'Resolutivo';
    case 'em_dia':
      return 'Em dia';
    case 'regular':
      return 'Regular';
    case 'atencao':
      return 'Atenção';
    case 'sem_score':
      return 'Sem score ainda';
  }
}
