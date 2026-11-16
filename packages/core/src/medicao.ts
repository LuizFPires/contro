// Avanço por quantitativo (pedido do usuário, 16/11/2026; protótipo aprovado).
// A atividade pode ter um quantitativo (total e unidade); o
// avanço dela passa a ser o % medido. Medições do dia ou de um período (de / até),
// em dias úteis de segunda a sexta, sem feriados. Tudo aqui é puro: telas, PDF e
// textos de WhatsApp leem destas funções e nunca recalculam por conta própria.
import { addDU, duEntre, type DataISO } from './calendar';

export const UNIDADES_QUANT = ['m²', 'm', 'm³', 'un', 'kg'] as const;
export type UnidadeQuant = (typeof UNIDADES_QUANT)[number];

export interface Quantitativo {
  total: number;
  unidade: string;
  /** Pessoas previstas (opcional, legado): as pessoas entram em cada medição. */
  pessoas: number | null;
  /** Início e fim previstos da atividade (cronograma vigente) e a duração em d.u. */
  inicio: DataISO;
  fim: DataISO;
  du: number;
}

export interface Medicao {
  id: string;
  tipo: 'dia' | 'periodo';
  de: DataISO;
  ate: DataISO;
  quantidade: number;
  /** Pessoas na frente (média por dia, no período). */
  pessoas: number;
  prestador?: string | null;
}

function parse(iso: DataISO): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const fmtISO = (d: Date): DataISO => d.toISOString().slice(0, 10);
const proximoDia = (iso: DataISO): DataISO => fmtISO(new Date(parse(iso).getTime() + 86_400_000));

/** Sábado ou domingo. */
export function ehFimDeSemana(iso: DataISO): boolean {
  const d = parse(iso).getUTCDay();
  return d === 0 || d === 6;
}

/** Dias úteis de `de` a `ate`, os dois inclusos (0 se ate < de). */
export function duInclusivo(de: DataISO, ate: DataISO): number {
  if (ate < de) return 0;
  return duEntre(de, proximoDia(ate));
}

/** Dias corridos de `de` a `ate`, os dois inclusos. */
export function diasCorridosInclusivo(de: DataISO, ate: DataISO): number {
  return Math.round((parse(ate).getTime() - parse(de).getTime()) / 86_400_000) + 1;
}

/** Dias úteis de uma medição (no mínimo 1). */
export function duDaMedicao(m: Pick<Medicao, 'de' | 'ate'>): number {
  return Math.max(1, duInclusivo(m.de, m.ate));
}

/** Meta do dia: total ÷ dias úteis da atividade. */
export function metaDoDia(q: Pick<Quantitativo, 'total' | 'du'>): number {
  return q.total / Math.max(1, q.du);
}

/** Soma medida (opcionalmente sem uma medição, ao editar). */
export function somaMedida(meds: Medicao[], excluirId?: string | null): number {
  return meds.reduce((s, m) => s + (m.id === excluirId ? 0 : m.quantidade), 0);
}

/** % medido de 0 a 1 (100% no máximo). */
export function fracaoMedida(total: number, meds: Medicao[]): number {
  if (!(total > 0)) return 0;
  return Math.min(1, somaMedida(meds) / total);
}

/**
 * Avanço da atividade aberta a partir das medições (0..99): 100% é concluir,
 * pelo caminho de sempre. Espelha contro_recalcular_avanco_medido no banco.
 */
export function avancoMedidoPct(total: number, meds: Medicao[]): number {
  if (!(total > 0)) return 0;
  return Math.min(99, Math.floor((somaMedida(meds) * 100) / total));
}

/** O quantitativo foi todo medido (a atividade pode ser concluída). */
export function medicaoCompleta(total: number, meds: Medicao[]): boolean {
  return total > 0 && somaMedida(meds) >= total - 1e-9;
}

/** Previsto até o início de `dia` (os dias úteis antes dele, dentro da atividade). */
export function previstoAte(q: Quantitativo, dia: DataISO): number {
  const decorridos = Math.max(0, Math.min(q.du, duEntre(q.inicio, dia)));
  return (q.total * decorridos) / Math.max(1, q.du);
}

export type TomSituacao = 'ok' | 'atraso' | 'hoje' | 'planejada';
export interface Situacao {
  real: number;
  previsto: number;
  /** real − previsto (negativo = atrasado). */
  diferenca: number;
  texto: string;
  tom: TomSituacao;
}

/** Tolerância de 1% do total para "em dia". */
const TOL = 0.01;

/**
 * Situação da atividade no início de `dia`: o medido (só as medições que
 * terminam antes de `dia`, quando `soAntes`) contra o previsto até ali.
 * Na ficha: dia = hoje e todas as medições.
 */
export function situacaoEm(
  q: Quantitativo,
  meds: Medicao[],
  dia: DataISO,
  opts: { soAntes?: boolean; excluirId?: string | null } = {},
): Situacao {
  const usadas = meds.filter((m) => m.id !== opts.excluirId && (!opts.soAntes || m.ate < dia));
  const real = somaMedida(usadas);
  const previsto = previstoAte(q, dia);
  const diferenca = real - previsto;
  const tol = q.total * TOL;
  const un = q.unidade;
  if (real >= q.total - 1e-9) return { real, previsto, diferenca, texto: 'Concluído', tom: 'ok' };
  if (dia < q.inicio && real < q.total)
    return {
      real,
      previsto,
      diferenca,
      texto: real > 0 ? 'Antes do início previsto' : `Começa ${rotuloDia(q.inicio)}`,
      tom: 'planejada',
    };
  if (diferenca < -tol) {
    const terminaHoje = q.fim === dia;
    return {
      real,
      previsto,
      diferenca,
      texto: `Atrasado ${formatarNumero(-diferenca)} ${un}${terminaHoje ? ' · termina hoje' : ''}`,
      tom: 'atraso',
    };
  }
  if (q.fim === dia) return { real, previsto, diferenca, texto: 'Termina hoje', tom: 'hoje' };
  if (diferenca > tol)
    return {
      real,
      previsto,
      diferenca,
      texto: `Adiantado ${formatarNumero(diferenca)} ${un}`,
      tom: 'ok',
    };
  return { real, previsto, diferenca, texto: 'Em dia', tom: 'ok' };
}

/** Quanto falta e quanto precisa por dia, de `apartir` (incluso) até o fim previsto. */
export function precisaParaPrazo(
  q: Quantitativo,
  real: number,
  apartir: DataISO,
): { faltam: number; duRestantes: number; porDia: number } {
  const faltam = Math.max(0, q.total - real);
  const duRestantes = Math.max(1, duInclusivo(apartir, q.fim));
  return { faltam, duRestantes, porDia: faltam / duRestantes };
}

export interface Referencia {
  /** Dias úteis do dia/período (1 quando a referência é por dia). */
  nDu: number;
  metaDia: number;
  meta: number;
  prazoDia: number;
  prazo: number;
  faltam: number;
  duRestantes: number;
  /** recuperar: precisa mais que a meta; adiantada: menos; igual: a meta basta. */
  tom: 'recuperar' | 'adiantada' | 'igual';
  titulo: string;
  detalhe: string;
}

/**
 * Referência do lançamento (dois cards): a meta do cronograma e quanto produzir
 * para entregar no prazo, contando só o que já foi medido antes de `de`
 * (ao editar, sem a própria medição).
 */
export function referenciaLancamento(
  q: Quantitativo,
  meds: Medicao[],
  de: DataISO,
  ate: DataISO,
  excluirId?: string | null,
): Referencia {
  const nDu = Math.max(1, duInclusivo(de, ate));
  const real = somaMedida(
    meds.filter((m) => m.id !== excluirId && m.ate < de),
    null,
  );
  const metaDia = metaDoDia(q);
  const { faltam, duRestantes, porDia } = precisaParaPrazo(q, real, de);
  const prazo = Math.min(faltam, porDia * nDu);
  const dif = porDia - metaDia;
  const tol = metaDia * TOL;
  const tom = dif > tol ? 'recuperar' : dif < -tol ? 'adiantada' : 'igual';
  const titulo =
    tom === 'recuperar'
      ? 'Para recuperar o prazo'
      : tom === 'adiantada'
        ? 'Para entregar no prazo (adiantada)'
        : 'Para entregar no prazo';
  const comparacao =
    tom === 'igual'
      ? ', igual à meta'
      : ` (${formatarNumero(Math.abs(dif), 1)} ${dif > 0 ? 'acima' : 'abaixo'} da meta)`;
  return {
    nDu,
    metaDia,
    meta: metaDia * nDu,
    prazoDia: porDia,
    prazo,
    faltam,
    duRestantes,
    tom,
    titulo,
    detalhe: `${formatarNumero(porDia, 1)} ${q.unidade}/dia${comparacao} · faltam ${formatarNumero(faltam)} ${q.unidade} em ${duRestantes} d.u. até ${rotuloDia(q.fim)}`,
  };
}

/** O período cruza com alguma medição (fora a que está sendo editada). */
export function sobrepoe(
  meds: Medicao[],
  de: DataISO,
  ate: DataISO,
  excluirId?: string | null,
): boolean {
  return meds.some((m) => m.id !== excluirId && m.de <= ate && m.ate >= de);
}

/** O dia está dentro de alguma medição (fora a que está sendo editada). */
export function diaMedido(meds: Medicao[], dia: DataISO, excluirId?: string | null): boolean {
  return meds.some((m) => m.id !== excluirId && m.de <= dia && m.ate >= dia);
}

/** Erro do período escolhido, ou null se pode lançar. */
export function erroPeriodo(
  meds: Medicao[],
  de: DataISO,
  ate: DataISO,
  hoje: DataISO,
  excluirId?: string | null,
): string | null {
  if (ate < de) return 'O fim vem antes do início.';
  if (ehFimDeSemana(de) || ehFimDeSemana(ate)) return 'Comece e termine em dia útil.';
  if (ate > hoje) return 'Só dá para lançar até hoje.';
  if (sobrepoe(meds, de, ate, excluirId))
    return 'O período inclui dias já medidos. Marque só dias livres.';
  return null;
}

/** Ordena as medições pela data (mais antiga primeiro). */
export function medicoesEmOrdem<T extends Medicao>(meds: T[]): T[] {
  return [...meds].sort((a, b) => (a.de < b.de ? -1 : a.de > b.de ? 1 : 0));
}

/** Produção por dia útil de uma medição (no período, a média). */
export function porDiaDaMedicao(m: Medicao): number {
  return m.quantidade / duDaMedicao(m);
}

export interface ProdutividadeLinha {
  m: Medicao;
  du: number;
  porDia: number;
  porPessoa: number;
  /** porDia / meta − 1. */
  vsMeta: number;
}

export interface Produtividade {
  dias: number;
  ritmo: number;
  pessoasMedia: number;
  porPessoa: number;
  /** ritmo / meta. */
  daMeta: number;
  linhas: ProdutividadeLinha[];
  melhor: ProdutividadeLinha | null;
  menor: ProdutividadeLinha | null;
  porPessoaMin: number;
  porPessoaMax: number;
  /** Pessoas na frente para bater a meta com o rendimento médio por pessoa. */
  pessoasParaMeta: number;
  bateramMeta: number;
}

/** Produtividade da atividade nesta obra (só as medições dela). */
export function produtividade(meds: Medicao[], metaDia: number): Produtividade {
  const linhas = medicoesEmOrdem(meds).map((m) => {
    const du = duDaMedicao(m);
    const porDia = m.quantidade / du;
    return { m, du, porDia, porPessoa: porDia / m.pessoas, vsMeta: porDia / metaDia - 1 };
  });
  const dias = linhas.reduce((s, l) => s + l.du, 0);
  const soma = linhas.reduce((s, l) => s + l.m.quantidade, 0);
  const pessoasDias = linhas.reduce((s, l) => s + l.m.pessoas * l.du, 0);
  const ritmo = dias ? soma / dias : 0;
  const pessoasMedia = dias ? pessoasDias / dias : 0;
  const porPessoa = pessoasMedia ? ritmo / pessoasMedia : 0;
  const ordenadas = [...linhas].sort((a, b) => b.porDia - a.porDia);
  const pp = linhas.map((l) => l.porPessoa);
  const mediaPP = pp.length ? pp.reduce((s, v) => s + v, 0) / pp.length : 0;
  return {
    dias,
    ritmo,
    pessoasMedia,
    porPessoa,
    daMeta: metaDia > 0 ? ritmo / metaDia : 0,
    linhas,
    melhor: ordenadas[0] ?? null,
    menor: ordenadas[ordenadas.length - 1] ?? null,
    porPessoaMin: pp.length ? Math.min(...pp) : 0,
    porPessoaMax: pp.length ? Math.max(...pp) : 0,
    pessoasParaMeta: mediaPP > 0 ? Math.ceil(metaDia / mediaPP - 1e-9) : 0,
    bateramMeta: linhas.filter((l) => l.porDia >= metaDia - 1e-9).length,
  };
}

export interface BarraDia {
  dia: DataISO;
  /** Produção do dia (no período, a média), ou null sem medição. */
  real: number | null;
  periodo: boolean;
  hoje: boolean;
}

/** Barras por dia útil da atividade (do início ao fim previsto). */
export function barrasPorDia(q: Quantitativo, meds: Medicao[], hoje: DataISO): BarraDia[] {
  const out: BarraDia[] = [];
  for (let i = 0; i < Math.max(1, q.du); i++) {
    const dia = addDU(q.inicio, i);
    const m = meds.find((x) => x.de <= dia && x.ate >= dia);
    out.push({
      dia,
      real: m ? porDiaDaMedicao(m) : null,
      periodo: m ? m.tipo === 'periodo' : false,
      hoje: dia === hoje,
    });
  }
  return out;
}

export interface LinhaMeta {
  dia: DataISO;
  meta: number;
  acumulado: number;
  real: number | null;
  periodo: boolean;
  hoje: boolean;
}

/** Tabela da Meta da atividade: meta e acumulado previsto por dia útil, e o real. */
export function tabelaMeta(q: Quantitativo, meds: Medicao[], hoje: DataISO): LinhaMeta[] {
  const meta = metaDoDia(q);
  return barrasPorDia(q, meds, hoje).map((b, i) => ({
    dia: b.dia,
    meta,
    acumulado: meta * (i + 1),
    real: b.real,
    periodo: b.periodo,
    hoje: b.hoje,
  }));
}

/** Texto da Meta para o WhatsApp: só a atividade, os próximos 5 dias úteis. */
export function textoMetaWhatsApp(args: {
  obra: string;
  numero: number | null;
  atividade: string;
  prestador: string | null;
  q: Quantitativo;
  meds: Medicao[];
  hoje: DataISO;
}): string {
  const { q } = args;
  const meta = metaDoDia(q);
  const linhas = tabelaMeta(q, args.meds, args.hoje)
    .filter((l) => l.dia >= args.hoje)
    .slice(0, 5)
    .map(
      (l) =>
        `${rotuloDia(l.dia)}: ${formatarNumero(l.meta, 1)} ${q.unidade} (acum. ${formatarNumero(l.acumulado)})`,
    );
  return [
    '*CONTRO · Meta*',
    args.obra,
    `${args.numero ? `#${args.numero} ` : ''}${args.atividade} · ${args.prestador || 'sem prestador'}`,
    '',
    `Meta ${formatarNumero(meta, 1)} ${q.unidade}/dia${q.pessoas ? ` com ${q.pessoas} ${q.pessoas === 1 ? 'pessoa' : 'pessoas'}` : ''}`,
    ...(linhas.length ? linhas : ['Sem dias úteis restantes no prazo da atividade.']),
  ].join('\n');
}

export interface LinhaComparativo {
  obraId: string;
  obra: string;
  prestador: string;
  quantidade: number;
  du: number;
  /** Pessoas média por dia (ponderada pelos dias). */
  pessoas: number;
  medicoes: number;
  /** Última data medida (para "quando"). */
  ultima: DataISO;
  estaObra: boolean;
}

export interface Comparativo {
  porDia: number;
  porPessoa: number;
  obras: number;
  prestadores: number;
  medicoes: number;
  porObra: (LinhaComparativo & { porDia: number; porPessoa: number; vsMedia: number })[];
  porPrestador: {
    prestador: string;
    porDia: number;
    porPessoa: number;
    quantidade: number;
    pessoas: number;
    obras: { obra: string; porDia: number; estaObra: boolean }[];
  }[];
}

/**
 * Comparativo da MESMA atividade entre obras: agrupa as medições por obra e
 * prestador (cada obra com o seu prestador) e por prestador.
 */
export function comparativoAtividade(
  meds: { obraId: string; obra: string; prestador: string | null; m: Medicao }[],
  obraAtual: string,
): Comparativo {
  const chave = (o: string, p: string) => `${o}\u0000${p}`;
  const grupos = new Map<string, LinhaComparativo & { pd: number }>();
  for (const x of meds) {
    const prest = x.prestador?.trim() || 'Sem prestador';
    const k = chave(x.obraId, prest);
    const du = duDaMedicao(x.m);
    const g = grupos.get(k) ?? {
      obraId: x.obraId,
      obra: x.obra,
      prestador: prest,
      quantidade: 0,
      du: 0,
      pessoas: 0,
      pd: 0,
      medicoes: 0,
      ultima: x.m.ate,
      estaObra: x.obraId === obraAtual,
    };
    g.quantidade += x.m.quantidade;
    g.du += du;
    g.pd += x.m.pessoas * du;
    g.medicoes += 1;
    if (x.m.ate > g.ultima) g.ultima = x.m.ate;
    grupos.set(k, g);
  }
  const linhas = [...grupos.values()].map((g) => ({ ...g, pessoas: g.du ? g.pd / g.du : 0 }));
  const tq = linhas.reduce((s, l) => s + l.quantidade, 0);
  const td = linhas.reduce((s, l) => s + l.du, 0);
  const tpd = linhas.reduce((s, l) => s + l.pessoas * l.du, 0);
  const porDia = td ? tq / td : 0;
  const porPessoa = tpd ? tq / tpd : 0;
  const porObra = linhas
    .map((g) => {
      const l = {
        obraId: g.obraId,
        obra: g.obra,
        prestador: g.prestador,
        quantidade: g.quantidade,
        du: g.du,
        pessoas: g.pessoas,
        medicoes: g.medicoes,
        ultima: g.ultima,
        estaObra: g.estaObra,
      };
      const pdia = l.du ? l.quantidade / l.du : 0;
      return {
        ...l,
        porDia: pdia,
        porPessoa: l.pessoas ? pdia / l.pessoas : 0,
        vsMedia: porDia ? pdia / porDia - 1 : 0,
      };
    })
    .sort((a, b) => b.porDia - a.porDia);
  const porP = new Map<string, typeof porObra>();
  for (const l of porObra) porP.set(l.prestador, [...(porP.get(l.prestador) ?? []), l]);
  const porPrestador = [...porP.entries()]
    .map(([prestador, ls]) => {
      const q = ls.reduce((s, l) => s + l.quantidade, 0);
      const d = ls.reduce((s, l) => s + l.du, 0);
      const p = ls.reduce((s, l) => s + l.pessoas * l.du, 0);
      return {
        prestador,
        porDia: d ? q / d : 0,
        porPessoa: p ? q / p : 0,
        quantidade: q,
        pessoas: d ? p / d : 0,
        obras: ls.map((l) => ({ obra: l.obra, porDia: l.porDia, estaObra: l.estaObra })),
      };
    })
    .sort((a, b) => b.porDia - a.porDia);
  return {
    porDia,
    porPessoa,
    obras: new Set(linhas.map((l) => l.obraId)).size,
    prestadores: porP.size,
    medicoes: linhas.reduce((s, l) => s + l.medicoes, 0),
    porObra,
    porPrestador,
  };
}

/** Linhas do comparativo para a planilha (cabeçalho + uma linha por obra). */
export function linhasPlanilhaComparativo(c: Comparativo, unidade: string): string[][] {
  return [
    [
      'Obra',
      'Prestador',
      `Quantidade (${unidade})`,
      'Dias úteis',
      'Pessoas (média)',
      `${unidade}/dia`,
      `${unidade}/pessoa·dia`,
      'Medições',
      'Última medição',
    ],
    ...c.porObra.map((l) => [
      l.obra,
      l.prestador,
      formatarNumero(l.quantidade, 2),
      String(l.du),
      formatarNumero(l.pessoas, 1),
      formatarNumero(l.porDia, 1),
      formatarNumero(l.porPessoa, 1),
      String(l.medicoes),
      rotuloDia(l.ultima),
    ]),
  ];
}

/** Número no padrão brasileiro (1.234,5), até `casas` decimais, sem zeros à toa. */
export function formatarNumero(n: number, casas = 0): string {
  if (!Number.isFinite(n)) return '0';
  const f = 10 ** casas;
  const r = Math.round(Math.abs(n) * f) / f;
  const [int, dec = ''] = r.toFixed(casas).split('.');
  const milhar = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const d = dec.replace(/0+$/, '');
  return `${n < 0 && r > 0 ? '−' : ''}${milhar}${d ? `,${d}` : ''}`;
}

/** Lê um número digitado no padrão brasileiro ("1.200", "95,5"). 0 se inválido. */
export function lerNumero(txt: string): number {
  const s = txt.trim().replace(/\s/g, '');
  if (!s) return 0;
  const n = s.includes(',')
    ? Number(s.replace(/\./g, '').replace(',', '.'))
    : /^\d{1,3}(\.\d{3})+$/.test(s)
      ? Number(s.replace(/\./g, ''))
      : Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
/** "qua 11/11" (padrão do app). */
export function rotuloDia(iso: DataISO): string {
  const d = parse(iso);
  return `${DIAS_SEMANA[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Título curto de uma medição ("Dia · ter 10/11" ou "qua 11/11 → qui 12/11"). */
export function tituloMedicao(m: Pick<Medicao, 'tipo' | 'de' | 'ate'>): string {
  return m.tipo === 'dia' || m.de === m.ate
    ? `Dia · ${rotuloDia(m.de)}`
    : `${rotuloDia(m.de)} → ${rotuloDia(m.ate)}`;
}

/** Grade do mês começando no domingo (calendário do lançamento). `mes` de 1 a 12. */
export function gradeDoMesDomingo(ano: number, mes: number): (DataISO | null)[] {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
  const dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const out: (DataISO | null)[] = Array.from({ length: primeiro.getUTCDay() }, () => null);
  for (let d = 1; d <= dias; d++) out.push(fmtISO(new Date(Date.UTC(ano, mes - 1, d))));
  return out;
}
