// Trilha de fases da obra (protótipo aprovado · tela "Fases"). A partir dos
// estados derivados (obra.ts) e das datas previstas, monta o status e os textos
// de cada fase e atividade. A tela só desenha o que sai daqui.
import type { DataISO } from './calendar';
import { normalizarAvanco, textoAvanco } from './avanco';
import type { AtividadeEstado } from './obra';
import type { Cronograma } from './schedule';

export type TipoProvidencia = 'contratacao' | 'locacao' | 'compra';

export interface TrilhaFaseEntrada {
  id: string;
  ordem: number;
  titulo: string;
}

export interface TrilhaAtividadeEntrada {
  id: string;
  fase_id: string;
  nome: string;
  predecessoras: string[];
  prestador: string | null;
  /** Providências ainda pendentes da atividade, na ordem em que aparecem. */
  providenciasPendentes: { tipo: TipoProvidencia; descricao: string }[];
  /** Concluída com foto (a foto é opcional; ausente = com foto). */
  temFoto?: boolean;
  /** Avanço parcial guardado (0..99); ausente = 0. */
  avancoPct?: number;
}

export interface EntradaTrilha {
  fases: TrilhaFaseEntrada[];
  /** Só atividades de topo (subitens ficam na ficha da atividade). */
  atividades: TrilhaAtividadeEntrada[];
  estados: Record<string, AtividadeEstado>;
  datas: Record<string, { inicio: DataISO; fim: DataISO }>;
}

export type StatusFaseTrilha = 'concluida' | 'execucao' | 'planejada';
/** Não há atividade bloqueada: aberta ("liberada") pode ser concluída a qualquer momento. */
export type StatusAtividadeTrilha = 'concluida' | 'atrasada' | 'liberada';

export interface AtividadeTrilha {
  id: string;
  nome: string;
  status: StatusAtividadeTrilha;
  /** "Concluída · foto arquivada", "Prevista 20/10–29/10 · falta locação: Andaime"… */
  sub: string;
  /** Prestador para o chip (só enquanto não concluída). */
  prestador: string | null;
  /** Aberta: pode concluir (botão de câmera; a foto é opcional). */
  podeConcluir: boolean;
  /** Concluída sem foto (dá para anexar depois). */
  semFoto: boolean;
  /** Avanço para o anel: 100 se concluída, senão o parcial (0..99). */
  avancoPct: number;
}

export interface FaseTrilha {
  id: string;
  n: number;
  titulo: string;
  status: StatusFaseTrilha;
  /** "concluída", "em execução", "planejada" (vai na etiqueta "Fase N · …"). */
  rotulo: string;
  concluidas: number;
  total: number;
  atrasadas: number;
  /** "2 atrasadas"; vazio quando não há atraso. */
  atrasoTxt: string;
  info: string;
  atividades: AtividadeTrilha[];
}

export const ROTULO_TIPO_PROVIDENCIA: Record<TipoProvidencia, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};

const ROTULO_FASE: Record<StatusFaseTrilha, string> = {
  concluida: 'concluída',
  execucao: 'em execução',
  planejada: 'planejada',
};

/** "2026-10-20" → "20/10". */
export function diaMes(iso: DataISO): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export function trilhaDeFases(e: EntradaTrilha): FaseTrilha[] {
  const concluida = (id: string) => Boolean(e.estados[id]?.concluida);

  // Fase atual = a primeira que ainda tem atividade por concluir.
  const porFase = new Map<string, TrilhaAtividadeEntrada[]>();
  for (const a of e.atividades) {
    const arr = porFase.get(a.fase_id) ?? [];
    arr.push(a);
    porFase.set(a.fase_id, arr);
  }
  const atual = e.fases.find((f) => (porFase.get(f.id) ?? []).some((a) => !concluida(a.id)));

  return e.fases.map((f) => {
    const atvs = porFase.get(f.id) ?? [];
    const nConcl = atvs.filter((a) => concluida(a.id)).length;
    const status: StatusFaseTrilha =
      nConcl === atvs.length ? 'concluida' : f.id === atual?.id ? 'execucao' : 'planejada';

    const atividades = atvs.map((a) => atividadeTrilha(a, e));
    const atrasadas = atividades.filter((a) => a.status === 'atrasada').length;

    let info: string;
    const semFoto = atividades.filter((x) => x.semFoto).length;
    const comLembrete = atvs.filter((a) => e.estados[a.id]?.lembretesPendentes).length;
    if (status === 'concluida')
      info = semFoto
        ? `Concluída · ${plural(semFoto, 'atividade sem foto', 'atividades sem foto')}`
        : 'Concluída com fotos de todas as etapas';
    else if (comLembrete > 0)
      info = `${comLembrete} com contratação, locação ou compra a providenciar`;
    else info = plural(atvs.length - nConcl, 'atividade a executar', 'atividades a executar');

    return {
      id: f.id,
      n: f.ordem,
      titulo: f.titulo,
      status,
      rotulo: ROTULO_FASE[status],
      concluidas: nConcl,
      total: atvs.length,
      atrasadas,
      atrasoTxt: atrasadas ? plural(atrasadas, 'atrasada', 'atrasadas') : '',
      info,
      atividades,
    };
  });
}

function atividadeTrilha(a: TrilhaAtividadeEntrada, e: EntradaTrilha): AtividadeTrilha {
  const est = e.estados[a.id];
  const datas = e.datas[a.id];
  const fim = datas ? diaMes(datas.fim) : '';

  if (est?.concluida) {
    return {
      id: a.id,
      nome: a.nome,
      status: 'concluida',
      sub: a.temFoto === false ? 'Concluída · sem foto' : 'Concluída · foto arquivada',
      prestador: null,
      podeConcluir: false,
      semFoto: a.temFoto === false,
      avancoPct: 100,
    };
  }

  // Lembrete pendente é só aviso: não trava a atividade.
  const p = a.providenciasPendentes[0];
  const lembrete = p
    ? ` · falta ${ROTULO_TIPO_PROVIDENCIA[p.tipo].toLowerCase()}: ${p.descricao}`
    : '';
  const atrasada = Boolean(est?.atrasada);
  const avancoPct = Math.min(99, normalizarAvanco(a.avancoPct));
  const feito = textoAvanco(avancoPct);
  const parcial = feito ? ` · ${feito}` : '';
  const sub = atrasada
    ? `ATRASADA · devia terminar ${fim}${parcial}${lembrete}`
    : `${datas ? `Prevista ${diaMes(datas.inicio)}–${fim}` : 'Prevista'}${parcial}${lembrete}`;

  return {
    id: a.id,
    nome: a.nome,
    status: atrasada ? 'atrasada' : 'liberada',
    sub,
    prestador: a.prestador,
    podeConcluir: true,
    semFoto: false,
    avancoPct,
  };
}

export interface FaixaFase {
  id: string;
  n: number;
  titulo: string;
  /** Dias úteis desde o início da obra (início da 1ª atividade, fim exclusivo da última). */
  es: number;
  ef: number;
  inicio: DataISO;
  fim: DataISO;
}

/**
 * Faixa de cada fase no cronograma (prévia da nova obra): da atividade que começa
 * primeiro até a que termina por último. Fases sem atividade ficam de fora.
 */
export function faixasDeFases(
  fases: TrilhaFaseEntrada[],
  atividades: { id: string; fase_id: string; pai_id: string | null }[],
  cronograma: Cronograma,
): FaixaFase[] {
  const out: FaixaFase[] = [];
  for (const f of fases) {
    const itens = atividades
      .filter((a) => a.fase_id === f.id && !a.pai_id)
      .map((a) => cronograma.porId[a.id])
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    if (!itens.length) continue;
    const primeira = itens.reduce((x, y) => (y.es < x.es ? y : x));
    const ultima = itens.reduce((x, y) => (y.ef > x.ef ? y : x));
    out.push({
      id: f.id,
      n: f.ordem,
      titulo: f.titulo,
      es: primeira.es,
      ef: ultima.ef,
      inicio: primeira.inicio_previsto,
      fim: ultima.fim_previsto,
    });
  }
  return out;
}
