// Analisador do Score (17/11/2026): para um nome, quanto cada indicador tirou
// do score, as ações que tiraram pontos (com o que aconteceu e o que teria
// contado), o que dá para fazer hoje e a simulação "se tivesse…". Usa a mesma
// régua de score.ts (pesos, janela, atraso em dias úteis).
import { type DataISO } from './calendar';
import { presencaDaPessoa, type Presenca, type PresencaObraEntrada } from './checkin';
import { atrasoDU, diaLocal } from './datas';
import { normalizarNome } from './nomes';
import {
  calcularScoreEquipe,
  calcularScorePrestadores,
  diaFim,
  inicioJanela,
  naJanela,
  PESOS_EQUIPE,
  PESOS_PRESTADOR,
  type IndicadoresEquipe,
  type IndicadoresPrestador,
  type ItemEquipe,
  type ItemPrestador,
  type Janela,
  type LinhaScore,
} from './score';

export type IndicadorEquipe = keyof IndicadoresEquipe;
export type IndicadorPrestador = keyof IndicadoresPrestador;
export type Indicador = IndicadorEquipe | IndicadorPrestador;

export interface PerdaIndicador {
  indicador: Indicador;
  /** Peso de tabela (35, 20…). */
  peso: number;
  /** Quanto vale de 100 neste score (peso redistribuído; 0 sem base). */
  vale: number;
  nota: number | null;
  /** Pontos que este indicador tirou do score (somam 100 − score). */
  perdidos: number;
}

export interface AcaoAnalisada {
  id: string;
  texto: string;
  obraNome: string;
  /** O prazo que conta para o indicador (original, vigente ou fim previsto). */
  prazo: DataISO;
  /** Dia em que foi concluída (null = aberta). */
  concluidaDia: DataISO | null;
  /** Dias úteis de atraso contra `prazo` (até hoje, se aberta). */
  du: number;
  replanejamentos: number;
}

export interface AnaliseIndicador {
  indicador: Indicador;
  /** Itens que entram na conta deste indicador. */
  base: number;
  /** Itens que contaram a favor (no prazo, no dia, com foto…). */
  acertos: number;
  /** As que tiraram pontos, a pior primeiro. */
  acoes: AcaoAnalisada[];
  /** Atrasos (d.u.) em ordem crescente, para mostrar a conta da mediana/média. */
  atrasos: number[];
  /** Score se as até 3 piores ações deste indicador tivessem saído certas. */
  simulacao: { score: number; quantas: number } | null;
  /** Presença na obra: por obra, esperados, feitos e as faltas. */
  presenca?: Presenca;
}

export interface AnaliseScore {
  score: number | null;
  perdas: PerdaIndicador[];
  indicadores: Partial<Record<Indicador, AnaliseIndicador>>;
  /** Abertas e vencidas: concluir hoje para de piorar a nota. */
  vencidasAbertas: AcaoAnalisada[];
}

/**
 * Pontos perdidos por indicador: peso × (1 − nota) sobre os pesos usados, em
 * pontos de 100, arredondados pelo maior resto para somarem 100 − score.
 */
export function perdasDoScore<K extends Indicador>(
  indicadores: Record<K, number | null>,
  pesos: Record<K, number>,
  score: number | null,
): PerdaIndicador[] {
  const ks = Object.keys(pesos) as K[];
  const usado = ks.reduce((s, k) => s + (indicadores[k] == null ? 0 : pesos[k]), 0);
  const brutos = ks.map((k) => {
    const nota = indicadores[k];
    const vale = nota == null || usado === 0 ? 0 : (pesos[k] / usado) * 100;
    return { k, nota, vale, bruto: nota == null ? 0 : vale * (1 - nota) };
  });
  const alvo = score == null ? Math.round(brutos.reduce((s, b) => s + b.bruto, 0)) : 100 - score;
  const base = brutos.map((b) => Math.floor(b.bruto));
  // floor(partes) ≤ alvo: só falta distribuir para cima.
  let falta = alvo - base.reduce((a, b) => a + b, 0);
  const ordem = brutos
    .map((b, i) => ({ i, resto: b.bruto - Math.floor(b.bruto), tem: b.nota != null }))
    .filter((x) => x.tem)
    .sort((a, b) => b.resto - a.resto);
  for (let j = 0; falta > 0 && ordem.length; j = (j + 1) % ordem.length, falta--)
    base[ordem[j].i]++;
  return brutos.map((b, i) => ({
    indicador: b.k,
    peso: pesos[b.k],
    vale: Math.round(b.vale),
    nota: b.nota,
    perdidos: base[i],
  }));
}

const meioDia = (d: DataISO) => `${d}T12:00:00`;
const pior = (a: AcaoAnalisada, b: AcaoAnalisada) =>
  b.du - a.du || b.replanejamentos - a.replanejamentos || a.prazo.localeCompare(b.prazo);

function acaoDe(
  i: ItemEquipe | ItemPrestador,
  prazo: DataISO,
  hoje: DataISO,
  replanejamentos = 0,
): AcaoAnalisada {
  return {
    id: i.id,
    texto: i.texto,
    obraNome: i.obraNome,
    prazo,
    concluidaDia: i.concluidaEm == null ? null : diaLocal(i.concluidaEm),
    du: atrasoDU(prazo, diaFim(i, hoje)),
    replanejamentos,
  };
}

/** Analisador de uma pessoa da equipe. `itens` podem ser de todos: filtra pela chave. */
export function analisarScoreEquipe(
  itens: ItemEquipe[],
  chave: string,
  janela: Janela,
  hoje: DataISO,
  presencas: PresencaObraEntrada[] = [],
): AnaliseScore {
  const meus = itens.filter((i) => i.chavePessoa === chave);
  const minhasPresencas = presencas.filter((p) => p.chavePessoa === chave);
  const linhaDe = (lista: ItemEquipe[]) =>
    calcularScoreEquipe(lista, janela, hoje, minhasPresencas).find((l) => l.chave === chave) as
      | LinhaScore<IndicadoresEquipe>
      | undefined;
  const linha = linhaDe(meus);
  const inicio = inicioJanela(hoje, janela);
  const validos = meus.filter((i) => naJanela(i, i.prazoOriginal, inicio, hoje));
  const score = linha?.score ?? null;
  const ind = linha?.indicadores;
  const perdas = ind ? perdasDoScore(ind, PESOS_EQUIPE, score) : [];

  /** Score com estas ações concluídas no prazo que conta (simulação). */
  const simular = (ids: Set<string>, ajuste: (i: ItemEquipe) => ItemEquipe) => {
    if (score == null || !ids.size) return null;
    const novo = linhaDe(meus.map((i) => (ids.has(i.id) ? ajuste(i) : i)))?.score;
    return novo == null ? null : { score: novo, quantas: ids.size };
  };
  const noPrazoOriginal = (i: ItemEquipe): ItemEquipe => ({
    ...i,
    concluidaEm: meioDia(i.prazoOriginal),
    prazo: i.prazo < i.prazoOriginal ? i.prazo : i.prazoOriginal,
  });

  const porOriginal = validos.map((i) => acaoDe(i, i.prazoOriginal, hoje, i.replanejamentos));
  const foraDoPrazo = porOriginal.filter((a) => a.concluidaDia == null || a.du > 0).sort(pior);
  const top3 = (xs: AcaoAnalisada[]) => new Set(xs.slice(0, 3).map((a) => a.id));
  const indicadores: AnaliseScore['indicadores'] = {};

  if (ind?.pontualidade != null)
    indicadores.pontualidade = {
      indicador: 'pontualidade',
      base: porOriginal.length,
      acertos: porOriginal.length - foraDoPrazo.length,
      acoes: foraDoPrazo,
      atrasos: [],
      simulacao: simular(top3(foraDoPrazo), noPrazoOriginal),
    };

  if (ind?.conclusaoDoDia != null) {
    const doDia = meus.filter(
      (i) =>
        !i.excluida &&
        i.prazo >= inicio &&
        i.prazo <= hoje &&
        (i.concluidaEm != null || i.prazo < hoje),
    );
    const falhas = doDia
      .filter((i) => i.concluidaEm == null || diaLocal(i.concluidaEm) > i.prazo)
      .map((i) => acaoDe(i, i.prazo, hoje, i.replanejamentos))
      .sort(pior);
    indicadores.conclusaoDoDia = {
      indicador: 'conclusaoDoDia',
      base: doDia.length,
      acertos: doDia.length - falhas.length,
      acoes: falhas,
      atrasos: [],
      simulacao: simular(top3(falhas), (i) => ({ ...i, concluidaEm: meioDia(i.prazo) })),
    };
  }

  if (ind?.respostaAtraso != null) {
    const atrasadas = porOriginal.filter((a) => a.du > 0).sort(pior);
    indicadores.respostaAtraso = {
      indicador: 'respostaAtraso',
      base: atrasadas.length,
      acertos: 0,
      acoes: atrasadas,
      atrasos: atrasadas.map((a) => a.du).sort((a, b) => a - b),
      // Se nenhuma passasse de 1 d.u. depois de vencer.
      simulacao:
        score == null
          ? null
          : (() => {
              const ids = new Set(atrasadas.filter((a) => a.du > 1).map((a) => a.id));
              if (!ids.size) return null;
              const umDia = (i: ItemEquipe): ItemEquipe => {
                const d = new Date(`${i.prazoOriginal}T12:00:00Z`);
                do d.setUTCDate(d.getUTCDate() + 1);
                while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
                return { ...i, concluidaEm: meioDia(d.toISOString().slice(0, 10)) };
              };
              return simular(ids, umDia);
            })(),
    };
  }

  if (ind?.replanejamentos != null) {
    const tarefas = validos.filter((i) => i.origem === 'tarefa' || i.origem === 'atividade');
    const replanejadas = tarefas
      .filter((i) => i.replanejamentos > 0)
      .map((i) => acaoDe(i, i.prazoOriginal, hoje, i.replanejamentos))
      .sort((a, b) => b.replanejamentos - a.replanejamentos || b.du - a.du);
    indicadores.replanejamentos = {
      indicador: 'replanejamentos',
      base: tarefas.length,
      acertos: tarefas.length - replanejadas.length,
      acoes: replanejadas,
      atrasos: [],
      simulacao: simular(top3(replanejadas), (i) => ({ ...i, replanejamentos: 0 })),
    };
  }

  if (ind?.pendencias != null) {
    const pend = porOriginal.filter((a) =>
      validos.some((i) => i.id === a.id && i.origem === 'pendencia'),
    );
    const falhas = pend.filter((a) => a.concluidaDia == null || a.du > 0).sort(pior);
    indicadores.pendencias = {
      indicador: 'pendencias',
      base: pend.length,
      acertos: pend.length - falhas.length,
      acoes: falhas,
      atrasos: [],
      simulacao: simular(top3(falhas), noPrazoOriginal),
    };
  }

  if (ind?.presenca != null) {
    const pres = presencaDaPessoa(minhasPresencas, inicio, hoje);
    const perdidos = perdas.find((p) => p.indicador === 'presenca')?.perdidos ?? 0;
    const faltas = pres.obras.reduce(
      (s, o) => s + o.faltas.reduce((t, f) => t + (f.tipo === 'dia' ? 1 : f.pedidos - f.feitos), 0),
      0,
    );
    indicadores.presenca = {
      indicador: 'presenca',
      base: pres.esperados,
      acertos: pres.feitos,
      acoes: [],
      atrasos: [],
      // Com check-in em todos os dias esperados, a Presença vira nota cheia.
      simulacao:
        score != null && perdidos > 0 ? { score: score + perdidos, quantas: faltas } : null,
      presenca: pres,
    };
  }

  return {
    score,
    perdas,
    indicadores,
    vencidasAbertas: foraDoPrazo.filter((a) => a.concluidaDia == null),
  };
}

/** Analisador de um prestador (chave = nome normalizado). */
export function analisarScorePrestador(
  itens: ItemPrestador[],
  chave: string,
  janela: Janela,
  hoje: DataISO,
): AnaliseScore {
  const meus = itens.filter((i) => normalizarNome(i.prestador) === chave);
  const linhaDe = (lista: ItemPrestador[]) =>
    calcularScorePrestadores(lista, janela, hoje).find((l) => l.chave === chave) as
      | LinhaScore<IndicadoresPrestador>
      | undefined;
  const linha = linhaDe(meus);
  const inicio = inicioJanela(hoje, janela);
  const validos = meus.filter((i) => naJanela(i, i.fimPrevisto, inicio, hoje));
  const score = linha?.score ?? null;
  const ind = linha?.indicadores;
  const perdas = ind ? perdasDoScore(ind, PESOS_PRESTADOR, score) : [];
  const simular = (ids: Set<string>, ajuste: (i: ItemPrestador) => ItemPrestador) => {
    if (score == null || !ids.size) return null;
    const novo = linhaDe(meus.map((i) => (ids.has(i.id) ? ajuste(i) : i)))?.score;
    return novo == null ? null : { score: novo, quantas: ids.size };
  };
  const noFim = (i: ItemPrestador): ItemPrestador => ({
    ...i,
    concluidaEm: meioDia(i.fimPrevisto),
  });
  const acoes = validos.map((i) => acaoDe(i, i.fimPrevisto, hoje));
  const fora = acoes.filter((a) => a.concluidaDia == null || a.du > 0).sort(pior);
  const top3 = (xs: AcaoAnalisada[]) => new Set(xs.slice(0, 3).map((a) => a.id));
  const indicadores: AnaliseScore['indicadores'] = {};
  if (ind?.noFimPrevisto != null)
    indicadores.noFimPrevisto = {
      indicador: 'noFimPrevisto',
      base: acoes.length,
      acertos: acoes.length - fora.length,
      acoes: fora,
      atrasos: [],
      simulacao: simular(top3(fora), noFim),
    };
  if (ind?.atrasoMedio != null) {
    const atrasadas = acoes.filter((a) => a.du > 0).sort(pior);
    indicadores.atrasoMedio = {
      indicador: 'atrasoMedio',
      base: acoes.length,
      acertos: acoes.length - atrasadas.length,
      acoes: atrasadas,
      atrasos: acoes.map((a) => a.du).sort((a, b) => a - b),
      simulacao: simular(top3(atrasadas), noFim),
    };
  }
  if (ind?.comFoto != null) {
    const semFoto = validos
      .filter((i) => i.concluidaEm != null && !i.comFoto)
      .map((i) => acaoDe(i, i.fimPrevisto, hoje))
      .sort(pior);
    const concluidas = validos.filter((i) => i.concluidaEm != null).length;
    indicadores.comFoto = {
      indicador: 'comFoto',
      base: concluidas,
      acertos: concluidas - semFoto.length,
      acoes: semFoto,
      atrasos: [],
      simulacao: simular(top3(semFoto), (i) => ({ ...i, comFoto: true })),
    };
  }
  return {
    score,
    perdas,
    indicadores,
    vencidasAbertas: fora.filter((a) => a.concluidaDia == null),
  };
}
