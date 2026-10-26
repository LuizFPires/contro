// Trilha de fases da obra (protótipo aprovado · tela "Fases"). A partir dos
// estados derivados (obra.ts) e das datas previstas, monta o status e os textos
// de cada fase e atividade. A tela só desenha o que sai daqui.
import type { DataISO } from './calendar';
import type { AtividadeEstado } from './obra';

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
}

export interface EntradaTrilha {
  fases: TrilhaFaseEntrada[];
  /** Só atividades de topo (subitens ficam na ficha da atividade). */
  atividades: TrilhaAtividadeEntrada[];
  estados: Record<string, AtividadeEstado>;
  datas: Record<string, { inicio: DataISO; fim: DataISO }>;
}

export type StatusFaseTrilha = 'concluida' | 'execucao' | 'planejada';
export type StatusAtividadeTrilha =
  | 'concluida'
  | 'atrasada'
  | 'liberada'
  | 'aguardando'
  | 'planejada';

export interface AtividadeTrilha {
  id: string;
  nome: string;
  status: StatusAtividadeTrilha;
  /** "Concluída · foto arquivada", "Liberada · 20/10–29/10"… */
  sub: string;
  /** Prestador para o chip (só enquanto não concluída). */
  prestador: string | null;
  /** Liberada para concluir com foto (botão de câmera). */
  podeConcluir: boolean;
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
  const nomePorId = new Map(e.atividades.map((a) => [a.id, a.nome]));
  const concluida = (id: string) => Boolean(e.estados[id]?.concluida);
  const faltam = (a: TrilhaAtividadeEntrada) =>
    a.predecessoras
      .filter((p) => !concluida(p))
      .map((p) => nomePorId.get(p))
      .filter((n): n is string => Boolean(n));

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

    const atividades = atvs.map((a) => atividadeTrilha(a, e, faltam(a)));
    const atrasadas = atividades.filter((a) => a.status === 'atrasada').length;
    const liberadas = atividades.filter((a) => a.podeConcluir).length;

    let info: string;
    if (status === 'concluida') info = 'Concluída com fotos de todas as etapas';
    else if (liberadas > 0)
      info = `${plural(liberadas, 'atividade liberada', 'atividades liberadas')} para executar`;
    else {
      const aguard = atvs.filter((a) => e.estados[a.id]?.aguardandoProvidencia).length;
      if (aguard > 0) info = `${aguard} aguardando contratação, locação ou compra`;
      else {
        const primeira = atvs
          .filter((a) => !concluida(a.id))
          .sort((x, y) => (e.datas[x.id]?.inicio ?? '').localeCompare(e.datas[y.id]?.inicio ?? ''))[0];
        const falta = primeira ? faltam(primeira) : [];
        info = falta.length ? `Libera quando concluir: ${falta.join(', ')}` : 'Aguardando liberação';
      }
    }

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

function atividadeTrilha(
  a: TrilhaAtividadeEntrada,
  e: EntradaTrilha,
  faltam: string[],
): AtividadeTrilha {
  const est = e.estados[a.id];
  const datas = e.datas[a.id];
  const fim = datas ? diaMes(datas.fim) : '';

  if (est?.concluida) {
    return {
      id: a.id,
      nome: a.nome,
      status: 'concluida',
      sub: 'Concluída · foto arquivada',
      prestador: null,
      podeConcluir: false,
    };
  }

  let sub: string;
  let status: StatusAtividadeTrilha;
  if (est?.aguardandoProvidencia) {
    const p = a.providenciasPendentes[0];
    sub = p
      ? `Aguardando ${ROTULO_TIPO_PROVIDENCIA[p.tipo].toLowerCase()}: ${p.descricao}`
      : 'Aguardando providência';
    status = 'aguardando';
  } else if (est?.liberada) {
    sub = datas ? `Liberada · ${diaMes(datas.inicio)}–${fim}` : 'Liberada';
    status = 'liberada';
  } else {
    sub = faltam.length ? `Planejada · aguarda ${faltam.join(', ')}` : 'Planejada';
    status = 'planejada';
  }

  if (est?.atrasada) {
    const ultimo = sub.split(' · ').slice(-1)[0];
    sub = `ATRASADA · devia terminar ${fim} · ${ultimo}`;
    status = 'atrasada';
  }

  return {
    id: a.id,
    nome: a.nome,
    status,
    sub,
    prestador: a.prestador,
    podeConcluir: Boolean(est?.liberada),
  };
}
