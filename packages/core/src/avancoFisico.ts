// Relatório de avanço físico (16/11/2026): para cada obra em andamento, as
// atividades com quantitativo, a curva medida, a projeção do término no ritmo
// atual e quanto esse ritmo empurra a inauguração (cronograma refeito pelo core).
import { addDU, deslocarDU, diaUtilAPartir, duEntre, type DataISO } from './calendar';
import {
  duInclusivo,
  medicoesEmOrdem,
  metaDoDia,
  situacaoEm,
  somaMedida,
  type Medicao,
  type Quantitativo,
  type Situacao,
} from './medicao';
import { previsaoEntrega, type EntradaRecuperacao } from './recuperacao';

export interface AtvQuantEntrada {
  id: string;
  /** Quantitativo com as datas do cronograma vigente. */
  q: Quantitativo;
  medicoes: Medicao[];
  concluida: boolean;
}

export type EstadoProjecao = 'concluida' | 'sem_medicao' | 'andamento';

export interface CurvaAvanco {
  /** Eixo em dias úteis contados a partir de `x0` (fim do dia N = N). */
  x0: DataISO;
  pontos: { du: number; acumulado: number }[];
  planoIni: number;
  planoFim: number;
  /** Término projetado no ritmo atual (null sem projeção). */
  fim: number | null;
  total: number;
}

export interface ProjecaoAtividade {
  id: string;
  estado: EstadoProjecao;
  real: number;
  pct: number;
  situacao: Situacao;
  meta: number;
  /** Medido por dia útil, do início até a última medição (null sem medição). */
  ritmo: number | null;
  fimPlanejado: DataISO;
  fimProjetado: DataISO | null;
  /** Dias úteis além do fim planejado (0 = no prazo). */
  atrasoDu: number;
  adiantaDu: number;
  /** Dias úteis que esta atividade, sozinha, empurra a inauguração prevista. */
  impactoDu: number;
  /** Ritmo para não mexer na inauguração (só quando impactoDu > 0). */
  precisaPorDia: number | null;
  curva: CurvaAvanco;
}

export interface AvancoFisicoObra {
  entregaOriginal: DataISO;
  /** Previsão atual (sem o ritmo das medições). */
  entregaPrevista: DataISO;
  /** Previsão com todas as atividades medidas no ritmo atual. */
  entregaNoRitmo: DataISO;
  /** Dias úteis além da inauguração planejada, no ritmo atual. */
  atrasoNoRitmoDu: number;
  /** Dias úteis que o ritmo das medições acrescenta à previsão atual. */
  impactoDu: number;
  atividades: ProjecaoAtividade[];
}

interface Restante {
  inicio: DataISO;
  du: number;
}

function semSubitens(e: EntradaRecuperacao, id: string): boolean {
  return !e.atividades.some((a) => a.pai_id === id);
}

/** O que falta, refeito como duração a partir de `inicio` (aplica no cronograma). */
function comRestantes(e: EntradaRecuperacao, rest: Map<string, Restante>): EntradaRecuperacao {
  return {
    ...e,
    atividades: e.atividades.map((a) => {
      const r = rest.get(a.id);
      return r ? { ...a, inicio_manual: null, inicio_minimo: r.inicio, duracao_du: r.du } : a;
    }),
  };
}

/** Projeção de uma atividade medida, sem o efeito na inauguração. */
export function projetarAtividade(
  a: AtvQuantEntrada,
  hoje: DataISO,
): Omit<ProjecaoAtividade, 'impactoDu' | 'precisaPorDia'> & { restante: Restante | null } {
  const { q } = a;
  const meds = medicoesEmOrdem(a.medicoes);
  const real = somaMedida(meds);
  const situacao = situacaoEm(q, meds, hoje);
  const primeiro = meds.length && meds[0].de < q.inicio ? meds[0].de : q.inicio;
  const ultimo = meds.length ? meds.reduce((m, x) => (x.ate > m ? x.ate : m), meds[0].ate) : null;
  const x0 = primeiro;
  let acc = 0;
  const pontos = [{ du: 0, acumulado: 0 }].concat(
    meds.map((m) => {
      acc += m.quantidade;
      return { du: duInclusivo(x0, m.ate), acumulado: Math.min(acc, q.total) };
    }),
  );
  const curva: CurvaAvanco = {
    x0,
    pontos,
    planoIni: duEntre(x0, q.inicio),
    planoFim: duInclusivo(x0, q.fim),
    fim: null,
    total: q.total,
  };
  const base = {
    id: a.id,
    real,
    pct: q.total > 0 ? Math.min(100, Math.floor((real * 100) / q.total)) : 0,
    situacao,
    meta: metaDoDia(q),
    fimPlanejado: q.fim,
    curva,
  };
  if (a.concluida || real >= q.total - 1e-9)
    return {
      ...base,
      estado: 'concluida',
      ritmo: ultimo ? real / Math.max(1, duInclusivo(primeiro, ultimo)) : null,
      fimProjetado: null,
      atrasoDu: 0,
      adiantaDu: 0,
      restante: null,
    };
  if (!ultimo || real <= 0)
    return {
      ...base,
      estado: 'sem_medicao',
      ritmo: null,
      fimProjetado: null,
      atrasoDu: 0,
      adiantaDu: 0,
      restante: null,
    };
  const ritmo = real / Math.max(1, duInclusivo(primeiro, ultimo));
  const hojeUtil = diaUtilAPartir(hoje);
  const depoisDoUltimo = addDU(ultimo, 1);
  const inicio = depoisDoUltimo > hojeUtil ? depoisDoUltimo : hojeUtil;
  const du = Math.max(1, Math.ceil((q.total - real) / ritmo - 1e-9));
  const fimProjetado = addDU(inicio, du - 1);
  curva.fim = duInclusivo(x0, fimProjetado);
  return {
    ...base,
    estado: 'andamento',
    ritmo,
    fimProjetado,
    atrasoDu: fimProjetado > q.fim ? duEntre(q.fim, fimProjetado) : 0,
    adiantaDu: q.fim > fimProjetado ? duEntre(fimProjetado, q.fim) : 0,
    restante: { inicio, du },
  };
}

/**
 * Avanço físico de uma obra: projeta cada atividade medida e refaz o
 * cronograma (previsão "realista" do core) com o que falta no ritmo atual,
 * uma a uma (impacto de cada) e todas juntas (nova data da inauguração).
 */
export function avancoFisicoDaObra(
  e: EntradaRecuperacao,
  atividades: AtvQuantEntrada[],
): AvancoFisicoObra {
  const base = previsaoEntrega(e);
  const proj = atividades.map((a) => projetarAtividade(a, e.hoje));
  const simulaveis = proj.filter(
    (p) => p.restante && e.atividades.some((x) => x.id === p.id) && semSubitens(e, p.id),
  );
  const entregaCom = (rest: Map<string, Restante>) =>
    previsaoEntrega({ ...comRestantes(e, rest), entregaOriginal: base.entregaOriginal })
      .entregaPrevista;

  const todas = new Map(simulaveis.map((p) => [p.id, p.restante as Restante]));
  const entregaNoRitmo = todas.size ? entregaCom(todas) : base.entregaPrevista;

  const resultado: ProjecaoAtividade[] = proj.map((p) => {
    const { restante, ...resto } = p;
    let impactoDu = 0;
    let precisaPorDia: number | null = null;
    if (restante && simulaveis.includes(p)) {
      const sozinha = entregaCom(new Map([[p.id, restante]]));
      impactoDu = sozinha > base.entregaPrevista ? duEntre(base.entregaPrevista, sozinha) : 0;
      if (impactoDu > 0 && p.fimProjetado) {
        // Terminando `impacto` d.u. antes, a inauguração não se mexe.
        const limite = deslocarDU(p.fimProjetado, -impactoDu);
        const dias = Math.max(1, duInclusivo(restante.inicio, limite));
        precisaPorDia = (p.curva.total - p.real) / dias;
      }
    }
    return { ...resto, impactoDu, precisaPorDia };
  });

  return {
    entregaOriginal: base.entregaOriginal,
    entregaPrevista: base.entregaPrevista,
    entregaNoRitmo,
    atrasoNoRitmoDu:
      entregaNoRitmo > base.entregaOriginal ? duEntre(base.entregaOriginal, entregaNoRitmo) : 0,
    impactoDu:
      entregaNoRitmo > base.entregaPrevista ? duEntre(base.entregaPrevista, entregaNoRitmo) : 0,
    atividades: ordenarProjecoes(resultado),
  };
}

const ORDEM_ESTADO: Record<EstadoProjecao, number> = { andamento: 0, sem_medicao: 1, concluida: 2 };

/** Quem mais atrasa a inauguração primeiro; depois o maior atraso; concluídas no fim. */
export function ordenarProjecoes(ps: ProjecaoAtividade[]): ProjecaoAtividade[] {
  return [...ps].sort(
    (a, b) =>
      b.impactoDu - a.impactoDu ||
      ORDEM_ESTADO[a.estado] - ORDEM_ESTADO[b.estado] ||
      b.atrasoDu - a.atrasoDu ||
      a.situacao.diferenca - b.situacao.diferenca,
  );
}

/** "1 dia útil" / "6 dias úteis". */
export function textoDiasUteis(n: number): string {
  return n === 1 ? '1 dia útil' : `${n} dias úteis`;
}
