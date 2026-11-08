// Pré-avaliação de entrega (só obras da Contorno): situação dos itens, nota
// projetada e comparação entre revisões. A tela só apresenta o que sai daqui.

export type ResultadoAvaliacao = 'conforme' | 'nao_conforme' | null;
export type SituacaoItem =
  | 'a_avaliar'
  | 'a_reconfirmar'
  | 'conforme'
  | 'resolvido'
  | 'nao_conforme';

export interface ItemAvaliacao {
  id: string;
  modeloItemId: string;
  secaoOrdem: number;
  secao: string;
  ordem: number;
  codigo: string | null;
  nome: string;
  pontos: number;
  resultado: ResultadoAvaliacao;
  reconfirmar: boolean;
  /** Status da pendência ligada; null = sem pendência (ou apagada). */
  pendenciaStatus: string | null;
}

export type ItemComparavel = Pick<
  ItemAvaliacao,
  'modeloItemId' | 'pontos' | 'resultado' | 'pendenciaStatus' | 'nome' | 'secao' | 'reconfirmar'
>;

type ItemSituacao = Pick<ItemAvaliacao, 'resultado' | 'reconfirmar' | 'pendenciaStatus'>;

/** Situação real do item, olhando a pendência do Check list. */
export function situacaoItem(item: ItemSituacao): SituacaoItem {
  if (item.resultado === 'conforme') return 'conforme';
  if (item.resultado === 'nao_conforme') {
    if (item.pendenciaStatus === null) return 'a_avaliar'; // pendência apagada
    return item.pendenciaStatus === 'fechada' ? 'resolvido' : 'nao_conforme';
  }
  return item.reconfirmar ? 'a_reconfirmar' : 'a_avaliar';
}

export const ROTULO_SITUACAO: Record<SituacaoItem, string> = {
  a_avaliar: 'A avaliar',
  a_reconfirmar: 'A reconfirmar',
  conforme: 'Conforme',
  resolvido: 'Resolvido',
  nao_conforme: 'Não conforme',
};

const respondido = (s: SituacaoItem) => s !== 'a_avaliar' && s !== 'a_reconfirmar';

export interface NotaAvaliacao {
  total: number;
  perdidos: number;
  obtidos: number;
  /** Nota projetada (0 a 100): o que ainda falta avaliar conta como conforme. */
  pct: number;
  respondidos: number;
  quantidade: number;
  naoConformes: number;
}

export function notaAvaliacao(
  itens: ItemSituacao[] & Pick<ItemAvaliacao, 'pontos'>[],
): NotaAvaliacao {
  let total = 0;
  let perdidos = 0;
  let responderam = 0;
  let naoConformes = 0;
  for (const it of itens) {
    const s = situacaoItem(it);
    total += it.pontos;
    if (s === 'nao_conforme') {
      perdidos += it.pontos;
      naoConformes += 1;
    }
    if (respondido(s)) responderam += 1;
  }
  return {
    total,
    perdidos,
    obtidos: total - perdidos,
    pct: total ? ((total - perdidos) / total) * 100 : 0,
    respondidos: responderam,
    quantidade: itens.length,
    naoConformes,
  };
}

/** Porcentagem no padrão brasileiro, com uma casa ("94,2%"). */
export function formatarNota(pct: number): string {
  return `${pct.toFixed(1).replace('.', ',')}%`;
}

export interface ResumoSecao<T extends ItemAvaliacao = ItemAvaliacao> {
  ordem: number;
  nome: string;
  itens: T[];
  respondidos: number;
  naoConformes: number;
  /** Aproveitamento do que já foi respondido; null se nada foi. */
  pct: number | null;
  status: string;
}

export function resumoSecoes<T extends ItemAvaliacao>(itens: T[]): ResumoSecao<T>[] {
  const mapa = new Map<number, T[]>();
  for (const it of itens) {
    const lista = mapa.get(it.secaoOrdem);
    if (lista) lista.push(it);
    else mapa.set(it.secaoOrdem, [it]);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ordem, doGrupo]) => {
      const ordenados = [...doGrupo].sort((a, b) => a.ordem - b.ordem);
      let pontosResp = 0;
      let pontosPerd = 0;
      let responderam = 0;
      let nc = 0;
      for (const it of ordenados) {
        const s = situacaoItem(it);
        if (!respondido(s)) continue;
        responderam += 1;
        pontosResp += it.pontos;
        if (s === 'nao_conforme') {
          nc += 1;
          pontosPerd += it.pontos;
        }
      }
      const base =
        responderam === 0
          ? 'Não iniciado'
          : responderam === ordenados.length
            ? 'Concluído'
            : `${responderam} de ${ordenados.length} itens`;
      const extra = nc ? ` · ${nc} ${nc === 1 ? 'não conforme' : 'não conformes'}` : '';
      return {
        ordem,
        nome: ordenados[0]?.secao ?? '',
        itens: ordenados,
        respondidos: responderam,
        naoConformes: nc,
        pct: pontosResp ? ((pontosResp - pontosPerd) / pontosResp) * 100 : null,
        status: base + extra,
      };
    });
}

const PESO_CRITICIDADE: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

/** O que está tirando ponto, das altas para as baixas (mesma ordem do Check list). */
export function tirandoPonto<T extends ItemAvaliacao>(
  itens: T[],
  criticidadeDe: (item: T) => string | null,
): T[] {
  const peso = (it: T) => PESO_CRITICIDADE[criticidadeDe(it) ?? 'media'] ?? 1;
  return itens
    .filter((it) => situacaoItem(it) === 'nao_conforme')
    .sort((a, b) => peso(a) - peso(b) || a.secaoOrdem - b.secaoOrdem || a.ordem - b.ordem);
}

/** Nota se este item for resolvido, em relação à nota atual. */
export function notaAoResolver(nota: NotaAvaliacao, pontos: number): number {
  return nota.total ? ((nota.obtidos + pontos) / nota.total) * 100 : 0;
}

/** Itens que ainda impedem o fechamento da revisão. */
export function faltamParaFechar(itens: ItemSituacao[]): number {
  return itens.filter((it) => !respondido(situacaoItem(it))).length;
}

export interface PreviaRevisao {
  aReconfirmar: number;
  pendentes: number;
  mantidos: number;
  aAvaliar: number;
}

/** O que a próxima revisão herda da anterior (a tela mostra antes de abrir). */
export function previaNovaRevisao(itens: ItemSituacao[]): PreviaRevisao {
  const r: PreviaRevisao = { aReconfirmar: 0, pendentes: 0, mantidos: 0, aAvaliar: 0 };
  for (const it of itens) {
    if (it.pendenciaStatus !== null && it.pendenciaStatus !== 'fechada') r.pendentes += 1;
    else if (it.resultado === 'nao_conforme' && it.pendenciaStatus === 'fechada')
      r.aReconfirmar += 1;
    else if (it.resultado === 'conforme') r.mantidos += 1;
    else r.aAvaliar += 1;
  }
  return r;
}

export interface ComparacaoRevisoes<T> {
  melhorou: T[];
  piorou: T[];
  continua: T[];
  ganhoPontos: number;
}

const perde = (it: ItemSituacao) => situacaoItem(it) === 'nao_conforme';

/** Compara duas revisões item a item (pelo item da lista, não pela cópia). */
export function compararRevisoes<T extends ItemComparavel>(
  anterior: T[],
  atual: T[],
): ComparacaoRevisoes<T> {
  const ant = new Map(anterior.map((it) => [it.modeloItemId, it]));
  const melhorou: T[] = [];
  const piorou: T[] = [];
  const continua: T[] = [];
  let ganhoPontos = 0;
  for (const it of atual) {
    const a = ant.get(it.modeloItemId);
    const perdiaAntes = a ? perde(a) : false;
    const perdeAgora = perde(it);
    if (perdiaAntes && perdeAgora) continua.push(it);
    else if (perdiaAntes) {
      melhorou.push(it);
      ganhoPontos += it.pontos;
    } else if (perdeAgora) {
      piorou.push(it);
      ganhoPontos -= it.pontos;
    }
  }
  return { melhorou, piorou, continua, ganhoPontos };
}

/** Nota oficial da Contorno, nos mesmos termos da projeção. */
export function pctOficial(pontos: number, total: number): number {
  return total ? (pontos / total) * 100 : 0;
}
