import type { AcessoPessoa } from './ambiente';
import { addDU, type DataISO } from './calendar';
import type { Acao } from './acoes';
import type { AgendaObra, ItemDia } from './agendaDia';
import { atrasoDU, diaLocal } from './datas';

// Obra geral: a data prevista é digitada pelo coordenador, sem cálculo de cronograma.

export interface AtividadeGeral {
  id: string;
  fase_id: string;
  pai_id: string | null;
  ordem: number;
  nome: string;
  data_prevista: DataISO | null;
  /** Primeira data prevista; fica fixa nos replanejamentos. */
  data_prevista_original: DataISO | null;
  replanejamentos: number;
  responsavel_id: string | null;
  concluida_em: string | null;
  avanco_pct: number;
  foto_conclusao_id: string | null;
  prestador: string | null;
}

export interface FaseGeralEntrada {
  id: string;
  ordem: number;
  titulo: string;
}

export type StatusGeral = 'concluida' | 'atrasada' | 'vence_hoje' | 'aberta';

export interface SubitemGeral {
  id: string;
  nome: string;
  feito: boolean;
  prazo: DataISO | null;
  prazoTxt: string | null;
}

export interface AtividadeGeralTrilha {
  id: string;
  nome: string;
  status: StatusGeral;
  prazo: DataISO | null;
  responsavelId: string | null;
  quem: string;
  sub: string;
  avancoPct: number;
  semFoto: boolean;
  prestador: string | null;
  subitens: SubitemGeral[];
}

export interface FaseGeral {
  id: string;
  n: number;
  titulo: string;
  total: number;
  concluidas: number;
  atrasadas: number;
  venceHoje: number;
  concluida: boolean;
  atividades: AtividadeGeralTrilha[];
}

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "qua 04/11". Lê a data em UTC, sem depender do fuso do aparelho. */
export function diaCurto(iso: DataISO): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DIAS_SEMANA[dia]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Prazo da atividade: a maior data entre os subitens; sem nenhuma, a da própria atividade. */
export function prazoAtividadeGeral(a: AtividadeGeral, subitens: AtividadeGeral[]): DataISO | null {
  let maior: DataISO | null = null;
  for (const s of subitens) {
    if (s.data_prevista && (maior === null || s.data_prevista > maior)) maior = s.data_prevista;
  }
  return maior ?? a.data_prevista;
}

export function statusAtividadeGeral(
  concluidaEm: string | null,
  prazo: DataISO | null,
  hoje: DataISO,
): StatusGeral {
  if (concluidaEm) return 'concluida';
  if (!prazo) return 'aberta';
  if (atrasoDU(prazo, hoje) > 0) return 'atrasada';
  if (prazo === hoje) return 'vence_hoje';
  return 'aberta';
}

function detalhe(status: StatusGeral, prazo: DataISO | null, semFoto: boolean): string {
  if (status === 'concluida') return semFoto ? 'concluída sem foto' : 'concluída';
  if (!prazo) return 'sem data';
  if (status === 'atrasada') return `era para ${diaCurto(prazo)}`;
  if (status === 'vence_hoje') return 'vence hoje';
  return diaCurto(prazo);
}

export function trilhaObraGeral(e: {
  fases: FaseGeralEntrada[];
  atividades: AtividadeGeral[];
  hoje: DataISO;
  pessoaId: string | null;
  nomes: Record<string, string>;
}): FaseGeral[] {
  const porOrdem = (a: { ordem: number }, b: { ordem: number }) => a.ordem - b.ordem;
  const filhos = new Map<string, AtividadeGeral[]>();
  for (const a of [...e.atividades].sort(porOrdem)) {
    if (a.pai_id === null) continue;
    filhos.set(a.pai_id, [...(filhos.get(a.pai_id) ?? []), a]);
  }

  return [...e.fases].sort(porOrdem).map((fase, i) => {
    const topo = e.atividades
      .filter((a) => a.fase_id === fase.id && a.pai_id === null)
      .sort(porOrdem);

    const atividades = topo.map((a): AtividadeGeralTrilha => {
      const subs = filhos.get(a.id) ?? [];
      const prazo = prazoAtividadeGeral(a, subs);
      const status = statusAtividadeGeral(a.concluida_em, prazo, e.hoje);
      const semFoto = status === 'concluida' && a.foto_conclusao_id === null;
      const nomeResp = a.responsavel_id ? e.nomes[a.responsavel_id] : undefined;
      const quem =
        a.responsavel_id !== null && a.responsavel_id === e.pessoaId
          ? 'Você'
          : (nomeResp ?? 'Sem responsável');
      return {
        id: a.id,
        nome: a.nome,
        status,
        prazo,
        responsavelId: a.responsavel_id,
        quem,
        sub: `${quem} · ${detalhe(status, prazo, semFoto)}`,
        avancoPct: a.avanco_pct,
        semFoto,
        prestador: a.prestador,
        subitens: subs.map((s) => ({
          id: s.id,
          nome: s.nome,
          feito: s.concluida_em !== null,
          prazo: s.data_prevista,
          prazoTxt: s.data_prevista ? diaCurto(s.data_prevista) : null,
        })),
      };
    });

    const concluidas = atividades.filter((a) => a.status === 'concluida').length;
    return {
      id: fase.id,
      n: i + 1,
      titulo: fase.titulo,
      total: atividades.length,
      concluidas,
      atrasadas: atividades.filter((a) => a.status === 'atrasada').length,
      venceHoje: atividades.filter((a) => a.status === 'vence_hoje').length,
      concluida: atividades.length > 0 && concluidas === atividades.length,
      atividades,
    };
  });
}

export function resumoObraGeral(fases: FaseGeral[]): string {
  if (fases.length === 0) return 'Nenhuma fase ainda';
  const atual = fases.find((f) => !f.concluida);
  if (!atual) return 'Todas as fases concluídas';
  const atrasadas = fases.reduce((soma, f) => soma + f.atrasadas, 0);
  const base = `Fase ${atual.n} de ${fases.length}`;
  if (atrasadas === 0) return base;
  return `${base} · ${atrasadas} ${atrasadas === 1 ? 'atividade atrasada' : 'atividades atrasadas'}`;
}

function maiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Atalhos de data: hoje, amanhã (dia corrido) e os 2 dias úteis seguintes a amanhã. */
export function atalhosDataPrevista(hoje: DataISO): { valor: DataISO; rotulo: string }[] {
  const [y, m, d] = hoje.split('-').map(Number);
  const amanha = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return [
    { valor: hoje, rotulo: 'Hoje' },
    { valor: amanha, rotulo: 'Amanhã' },
    ...[1, 2].map((n) => {
      const valor = addDU(amanha, n);
      return { valor, rotulo: maiuscula(diaCurto(valor)) };
    }),
  ];
}

/** Só esconde e mostra botões; quem decide de verdade é o banco (contro_planeja_obra). */
export function podePlanejarObraGeral(p: AcessoPessoa): boolean {
  return p.administrador || p.papelGeral === 'coordenador';
}

function filhosPorPai(atividades: AtividadeGeral[]): Map<string, AtividadeGeral[]> {
  const filhos = new Map<string, AtividadeGeral[]>();
  for (const a of [...atividades].sort((x, y) => x.ordem - y.ordem)) {
    if (a.pai_id === null) continue;
    filhos.set(a.pai_id, [...(filhos.get(a.pai_id) ?? []), a]);
  }
  return filhos;
}

function quemGeral(
  responsavelId: string | null,
  pessoaId: string | null,
  nomes: Record<string, string>,
): string {
  if (responsavelId !== null && responsavelId === pessoaId) return 'Você';
  return (responsavelId ? nomes[responsavelId] : undefined) ?? 'Sem responsável';
}

/** "Hoje" da obra geral: atividades de topo abertas, com prazo, atrasadas ou para hoje. */
export function agendaObraGeral(e: {
  atividades: AtividadeGeral[];
  hoje: DataISO;
  pessoaId: string | null;
  nomes: Record<string, string>;
}): AgendaObra {
  const filhos = filhosPorPai(e.atividades);
  const atrasados: ItemDia[] = [];
  const hoje: ItemDia[] = [];
  for (const a of e.atividades) {
    if (a.pai_id !== null || a.concluida_em !== null) continue;
    const prazo = prazoAtividadeGeral(a, filhos.get(a.id) ?? []);
    if (!prazo) continue;
    const status = statusAtividadeGeral(null, prazo, e.hoje);
    if (status !== 'atrasada' && status !== 'vence_hoje') continue;
    const item: ItemDia = {
      chave: `geral:${a.id}`,
      tipo: 'concluir',
      nome: a.nome,
      data: prazo,
      atraso: status === 'atrasada',
      pessoa: quemGeral(a.responsavel_id, e.pessoaId, e.nomes),
    };
    (item.atraso ? atrasados : hoje).push(item);
  }
  atrasados.sort((x, y) => x.data.localeCompare(y.data) || x.nome.localeCompare(y.nome, 'pt-BR'));
  hoje.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  return { atrasados, hoje };
}

/** Texto de linha do Hoje para atividade de obra geral. */
export function detalheItemGeral(i: ItemDia): string {
  const quem = i.pessoa ?? 'Sem responsável';
  return i.atraso
    ? `${quem} · devia terminar ${diaCurto(i.data)}`
    : `${quem} · previsto concluir hoje`;
}

/** Uma ação por atividade de topo com prazo (sem prazo, fica fora: `Acao.prazo` é obrigatório). */
export function acoesDaObraGeral(
  atividades: AtividadeGeral[],
  obraId: string,
  obraNome: string,
  nomes: Record<string, string>,
): Acao[] {
  void obraNome;
  const filhos = filhosPorPai(atividades);
  const acoes: Acao[] = [];
  for (const a of atividades) {
    if (a.pai_id !== null) continue;
    const prazo = prazoAtividadeGeral(a, filhos.get(a.id) ?? []);
    if (!prazo) continue;
    acoes.push({
      origem: 'atividade',
      id: a.id,
      obraId,
      texto: a.nome,
      prazo,
      aberta: a.concluida_em === null,
      responsavelId: a.responsavel_id,
      responsavelNome: a.responsavel_id ? (nomes[a.responsavel_id] ?? null) : null,
      concluidaEm: a.concluida_em,
    });
  }
  return acoes;
}

export interface EficienciaGeral {
  noPrazo: number;
  total: number;
  pct: number | null;
}

/**
 * Prazo original da atividade: o original dela; sem ele, o maior entre os
 * subitens (o original de cada um, ou a data dele); sem subitem com data, a
 * data da própria atividade.
 */
function prazoOriginalAtividadeGeral(
  a: AtividadeGeral,
  subitens: AtividadeGeral[],
): DataISO | null {
  if (a.data_prevista_original) return a.data_prevista_original;
  let maior: DataISO | null = null;
  for (const s of subitens) {
    const d = s.data_prevista_original ?? s.data_prevista;
    if (d && (maior === null || d > maior)) maior = d;
  }
  return maior ?? a.data_prevista;
}

/** Concluídas contra o prazo original e abertas já atrasadas. */
export function eficienciaObraGeral(atividades: AtividadeGeral[], hoje: DataISO): EficienciaGeral {
  const filhos = filhosPorPai(atividades);
  let noPrazo = 0;
  let total = 0;
  for (const a of atividades) {
    if (a.pai_id !== null) continue;
    if (a.concluida_em !== null) {
      const original = prazoOriginalAtividadeGeral(a, filhos.get(a.id) ?? []);
      if (!original) continue;
      total += 1;
      if (atrasoDU(original, diaLocal(a.concluida_em)) === 0) noPrazo += 1;
    } else {
      const prazo = prazoAtividadeGeral(a, filhos.get(a.id) ?? []);
      if (prazo && atrasoDU(prazo, hoje) > 0) total += 1;
    }
  }
  return { noPrazo, total, pct: total === 0 ? null : Math.round((100 * noPrazo) / total) };
}

export function textoEficiencia(e: EficienciaGeral): string | null {
  return e.pct === null ? null : `${e.pct}% no prazo`;
}

/** Bloco "Ações da equipe" da obra: visão da obra (coordenador) ou só da pessoa (membro). */
export function textoAcoesBloco(
  acoes: Acao[],
  hoje: DataISO,
  pessoaId: string | null,
  soDaPessoa: boolean,
): { principal: string; detalhe: string | null; atrasadas: number } {
  const abertas = acoes.filter(
    (a) => a.aberta && (!soDaPessoa || (pessoaId !== null && a.responsavelId === pessoaId)),
  );
  const atrasadas = abertas.filter((a) => atrasoDU(a.prazo, hoje) > 0).length;
  const vencemHoje = abertas.filter((a) => a.prazo === hoje).length;
  const n = abertas.length;
  const principal = soDaPessoa
    ? `${n} ${n === 1 ? 'sua aberta' : 'suas abertas'}`
    : `${n} ${n === 1 ? 'aberta' : 'abertas'} na obra`;
  let detalhe: string | null = null;
  if (atrasadas > 0) detalhe = `${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}`;
  else if (soDaPessoa && vencemHoje > 0)
    detalhe = `${vencemHoje} ${vencemHoje === 1 ? 'vence' : 'vencem'} hoje`;
  return { principal, detalhe, atrasadas };
}
