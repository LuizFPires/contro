// Log de mudanças dos itens (atividades, tarefas, pendências e providências):
// transforma os eventos já gravados em linhas do tempo, agrupa por dia, filtra
// e monta a "Vida do item". Puro: recebe itens e eventos já carregados.
// "Vencida" não é evento: é derivada (item ainda aberto no primeiro dia útil
// depois do prazo). Dias úteis de segunda a sexta, sem feriados.
import { addDU, type DataISO } from './calendar';
import { atrasoDU, diaLocal } from './datas';
import { nomeCurto } from './nomes';

export type TipoLinhaLog =
  | 'criada'
  | 'atribuida'
  | 'replanejada'
  | 'inicio_ajustado'
  | 'avanco'
  | 'concluida'
  | 'resolvida'
  | 'reaberta'
  | 'vencida'
  | 'excluida'
  | 'restaurada'
  | 'apontada';
export type OrigemLog = 'atividade' | 'tarefa' | 'pendencia' | 'providencia';
export type CorLog = 'neutra' | 'ok' | 'atencao' | 'atraso';

export interface LinhaLog {
  id: string;
  /** Timestamp ISO da mudança. */
  em: string;
  /** Dia local da mudança. */
  dia: DataISO;
  tipo: TipoLinhaLog;
  origem: OrigemLog;
  itemId: string;
  itemTexto: string;
  obraId: string;
  obraNome: string;
  /** Nome curto de quem mudou (na "vencida", do responsável). */
  pessoa: string | null;
  /** Id de quem mudou (na "vencida", do responsável, se tiver login). */
  pessoaId: string | null;
  detalhe: string;
  cor: CorLog;
}

export interface EventoBruto {
  id: string;
  itemId: string;
  tipo: string;
  por: string | null;
  porNome: string | null;
  em: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
}

export interface ItemLog {
  origem: OrigemLog;
  id: string;
  obraId: string;
  obraNome: string;
  texto: string;
  /** Prazo vigente (atividade: fim previsto do cronograma vigente). */
  prazo: DataISO | null;
  prazoOriginal: DataISO | null;
  aberta: boolean;
  concluidaEm: string | null;
  responsavelNome: string | null;
  /** Id do responsável com login (filtro "Eu" na linha "vencida"). */
  responsavelId?: string | null;
  /**
   * Quando o item nasceu (tarefa: created_at; pendência: apontada_em; atividade:
   * início da obra). Base dos "dias aberta" quando o evento de criação está fora
   * da janela carregada.
   */
  criadaEm?: string | null;
  excluida: boolean;
  /** Tarefa ligada a uma providência: aparece no log como "providencia". */
  vinculoProvidencia?: boolean;
}

export interface EntradaLog {
  itens: ItemLog[];
  eventos: { origem: OrigemLog; evento: EventoBruto }[];
  hoje: DataISO;
  formatarData: (d: DataISO) => string;
}

/** Janela de carga do log, em dias corridos até hoje (limita as "vencidas"). */
export const JANELA_LOG_DIAS = 90;

const COR: Record<TipoLinhaLog, CorLog> = {
  criada: 'neutra',
  atribuida: 'neutra',
  replanejada: 'atencao',
  inicio_ajustado: 'atencao',
  avanco: 'neutra',
  concluida: 'ok',
  resolvida: 'ok',
  reaberta: 'neutra',
  vencida: 'atraso',
  excluida: 'neutra',
  restaurada: 'neutra',
  apontada: 'neutra',
};

const ROTULO: Record<TipoLinhaLog, string> = {
  criada: 'Criada',
  atribuida: 'Atribuída',
  replanejada: 'Replanejada',
  inicio_ajustado: 'Início ajustado',
  avanco: 'Avanço',
  concluida: 'Concluída',
  resolvida: 'Resolvida',
  reaberta: 'Reaberta',
  vencida: 'Venceu',
  excluida: 'Excluída',
  restaurada: 'Restaurada',
  apontada: 'Apontada',
};

/** Rótulo do tipo na linha do Log (a "vencida" por extenso). */
export function rotuloLinhaLog(tipo: TipoLinhaLog): string {
  return tipo === 'vencida' ? 'Venceu sem concluir' : ROTULO[tipo];
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

function instante(em: string): number {
  const t = Date.parse(em);
  return Number.isNaN(t) ? 0 : t;
}

/** Dias corridos de a até b (datas, sem hora). */
function diasCorridos(a: DataISO, b: DataISO): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function data(v: unknown): DataISO | null {
  return typeof v === 'string' && RE_DATA.test(v.slice(0, 10)) ? v.slice(0, 10) : null;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function origemDoItem(item: ItemLog): OrigemLog {
  return item.vinculoProvidencia ? 'providencia' : item.origem;
}

/** Dia em que o item vence (primeiro dia útil depois do prazo), se venceu aberto. */
function diaVencida(item: ItemLog, hoje: DataISO): DataISO | null {
  if (item.excluida || !item.prazo) return null;
  const dia = addDU(item.prazo, 1);
  if (dia > hoje) return null;
  if (diasCorridos(dia, hoje) > JANELA_LOG_DIAS) return null;
  const abertoNoDia = item.concluidaEm == null ? item.aberta : diaLocal(item.concluidaEm) > dia;
  return abertoNoDia ? dia : null;
}

/** "no prazo" ou "<n> d.u. depois do <referência>". */
function atrasoTexto(referencia: DataISO | null, dia: DataISO, nome: string): string | null {
  if (!referencia) return null;
  const n = atrasoDU(referencia, dia);
  return n > 0 ? `${n} d.u. depois do ${nome}` : 'no prazo';
}

function juntar(partes: (string | null)[]): string {
  return partes.filter((p): p is string => Boolean(p)).join(' · ');
}

interface Passo {
  tipo: TipoLinhaLog;
  /** Só para replanejada: a n-ésima vez. */
  vez?: number;
  /** Detalhe principal. */
  base: string;
  /** Complemento depois da vez (motivo do replanejamento). */
  extra?: string | null;
  evento: EventoBruto;
}

/** Converte os eventos de um item em passos do log (ignora os que não entram). */
function passosDoItem(
  item: ItemLog,
  eventos: EventoBruto[],
  formatarData: (d: DataISO) => string,
): Passo[] {
  const ordenados = [...eventos].sort((a, b) => instante(a.em) - instante(b.em));
  const passos: Passo[] = [];
  let vezes = 0;
  const para = item.responsavelNome ? `para ${nomeCurto(item.responsavelNome)}` : '';
  for (const ev of ordenados) {
    const dia = diaLocal(ev.em);
    const antes = ev.antes ?? {};
    const depois = ev.depois ?? {};
    switch (ev.tipo) {
      case 'criada': {
        if (item.origem === 'tarefa' && item.vinculoProvidencia) {
          passos.push({ tipo: 'atribuida', base: para, evento: ev });
          break;
        }
        const prazo = data(depois.prazo) ?? (item.origem === 'tarefa' ? item.prazoOriginal : null);
        passos.push({
          tipo: 'criada',
          base: prazo ? `prazo ${formatarData(prazo)}` : '',
          evento: ev,
        });
        break;
      }
      case 'apontada':
        passos.push({
          tipo: 'apontada',
          base: item.prazo ? `prazo ${formatarData(item.prazo)}` : '',
          evento: ev,
        });
        break;
      case 'responsavel_alterado':
        passos.push({ tipo: 'atribuida', base: para || 'responsável alterado', evento: ev });
        break;
      case 'replanejada': {
        vezes += 1;
        const de = data(antes.prazo);
        const ate = data(depois.prazo);
        const motivo = texto(depois.motivo);
        passos.push({
          tipo: 'replanejada',
          vez: vezes,
          base: de && ate ? `de ${formatarData(de)} para ${formatarData(ate)}` : 'prazo alterado',
          extra: motivo ? `"${motivo}"` : null,
          evento: ev,
        });
        break;
      }
      case 'inicio_ajustado': {
        const de = data(antes.inicio_manual) ?? data(antes.inicio);
        const ate = data(depois.inicio_manual) ?? data(depois.inicio);
        passos.push({
          tipo: 'inicio_ajustado',
          base: de && ate ? `de ${formatarData(de)} para ${formatarData(ate)}` : 'início ajustado',
          evento: ev,
        });
        break;
      }
      case 'avanco': {
        const pct = depois.pct;
        passos.push({
          tipo: 'avanco',
          base: typeof pct === 'number' ? `${pct}% feito` : '',
          evento: ev,
        });
        break;
      }
      case 'concluida':
        if (item.origem === 'atividade') {
          passos.push({
            tipo: 'concluida',
            base: juntar([
              atrasoTexto(item.prazo, dia, 'fim previsto'),
              depois.foto_id ? 'com foto' : null,
            ]),
            evento: ev,
          });
        } else {
          passos.push({
            tipo: 'concluida',
            base: atrasoTexto(item.prazoOriginal ?? item.prazo, dia, 'prazo') ?? '',
            evento: ev,
          });
        }
        break;
      case 'resolvida':
        passos.push({
          tipo: 'resolvida',
          base: atrasoTexto(item.prazo, dia, 'prazo') ?? '',
          evento: ev,
        });
        break;
      case 'reaberta':
      case 'excluida':
      case 'restaurada':
        passos.push({ tipo: ev.tipo, base: '', evento: ev });
        break;
      default:
        // editada, subitem, plano_recuperacao, foto_anexada e tipos antigos não entram.
        break;
    }
  }
  return passos;
}

function linhaVencida(item: ItemLog, dia: DataISO, formatarData: (d: DataISO) => string): LinhaLog {
  return {
    id: `vencida:${item.id}`,
    em: `${dia}T00:00:00`,
    dia,
    tipo: 'vencida',
    origem: origemDoItem(item),
    itemId: item.id,
    itemTexto: item.texto,
    obraId: item.obraId,
    obraNome: item.obraNome,
    pessoa: nomeCurto(item.responsavelNome) || null,
    pessoaId: item.responsavelId ?? null,
    detalhe: `prazo era ${formatarData(item.prazo as DataISO)}`,
    cor: 'atraso',
  };
}

/** Linhas do log de todas as obras carregadas, da mais recente para a mais antiga. */
export function montarLog(e: EntradaLog): LinhaLog[] {
  const porItem = new Map<string, EventoBruto[]>();
  for (const { origem, evento } of e.eventos) {
    const chave = `${origem === 'providencia' ? 'tarefa' : origem}:${evento.itemId}`;
    const lista = porItem.get(chave) ?? [];
    lista.push(evento);
    porItem.set(chave, lista);
  }

  const linhas: LinhaLog[] = [];
  for (const item of e.itens) {
    const chave = `${item.origem === 'providencia' ? 'tarefa' : item.origem}:${item.id}`;
    for (const p of passosDoItem(item, porItem.get(chave) ?? [], e.formatarData)) {
      linhas.push({
        id: p.evento.id,
        em: p.evento.em,
        dia: diaLocal(p.evento.em),
        tipo: p.tipo,
        origem: origemDoItem(item),
        itemId: item.id,
        itemTexto: item.texto,
        obraId: item.obraId,
        obraNome: item.obraNome,
        pessoa: nomeCurto(p.evento.porNome) || null,
        pessoaId: p.evento.por,
        detalhe: juntar([p.base, p.vez ? `${p.vez}ª vez` : null, p.extra ?? null]),
        cor: COR[p.tipo],
      });
    }
    const dia = diaVencida(item, e.hoje);
    if (dia) linhas.push(linhaVencida(item, dia, e.formatarData));
  }

  return linhas.sort(
    (a, b) =>
      instante(b.em) - instante(a.em) ||
      a.origem.localeCompare(b.origem) ||
      a.itemTexto.localeCompare(b.itemTexto, 'pt-BR'),
  );
}

/** Agrupa as linhas (já ordenadas) por dia, mantendo a ordem. */
export function agruparPorDia(
  linhas: LinhaLog[],
  formatarDiaCompleto: (d: DataISO) => string,
): { dia: DataISO; rotulo: string; linhas: LinhaLog[] }[] {
  const grupos: { dia: DataISO; rotulo: string; linhas: LinhaLog[] }[] = [];
  const porDia = new Map<DataISO, LinhaLog[]>();
  for (const l of linhas) {
    let lista = porDia.get(l.dia);
    if (!lista) {
      lista = [];
      porDia.set(l.dia, lista);
      grupos.push({ dia: l.dia, rotulo: formatarDiaCompleto(l.dia), linhas: lista });
    }
    lista.push(l);
  }
  return grupos;
}

export type FiltroLog = {
  obraId?: string;
  tipo?: 'replanejadas' | 'atividades' | 'tarefas' | 'pendencias';
  /** "Eu": id da pessoa logada (comparado com o id da linha). Tem precedência sobre o nome. */
  pessoaId?: string;
  /** "Eu" antigo: nome completo da pessoa, comparado pelo nome curto da linha. */
  pessoaNome?: string;
};

export function filtrarLog(linhas: LinhaLog[], f: FiltroLog): LinhaLog[] {
  const pessoa =
    !f.pessoaId && f.pessoaNome ? nomeCurto(f.pessoaNome).toLocaleLowerCase('pt-BR') : null;
  return linhas.filter((l) => {
    if (f.obraId && l.obraId !== f.obraId) return false;
    if (f.pessoaId && l.pessoaId !== f.pessoaId) return false;
    if (pessoa && (l.pessoa ?? '').toLocaleLowerCase('pt-BR') !== pessoa) return false;
    switch (f.tipo) {
      case 'replanejadas':
        return l.tipo === 'replanejada' || l.tipo === 'inicio_ajustado';
      case 'atividades':
        return l.origem === 'atividade';
      case 'tarefas':
        return l.origem === 'tarefa' || l.origem === 'providencia';
      case 'pendencias':
        return l.origem === 'pendencia';
      default:
        return true;
    }
  });
}

export interface PassoVida {
  em: string;
  rotulo: string;
  detalhe: string;
  cor: CorLog;
  /** Nome curto de quem fez (na "vencida", do responsável). */
  pessoa: string | null;
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/**
 * "Vida do item": os passos em ordem (criada → replanejada 1x → … → concluída,
 * com a "vencida" derivada e as fotos anexadas) e o resumo
 * "N d.u. além do prazo original · N replanejamentos · N dias aberta".
 */
export function vidaDoItem(
  item: ItemLog,
  eventos: EventoBruto[],
  hoje: DataISO,
  formatarData: (d: DataISO) => string,
): { passos: PassoVida[]; resumo: string } {
  const doItem = eventos.filter((ev) => ev.itemId === item.id);
  const passos: PassoVida[] = passosDoItem(item, doItem, formatarData).map((p) => ({
    em: p.evento.em,
    rotulo: p.vez ? `${ROTULO[p.tipo]} ${p.vez}x` : ROTULO[p.tipo],
    detalhe: juntar([p.base, p.extra ?? null]),
    cor: COR[p.tipo],
    pessoa: nomeCurto(p.evento.porNome) || null,
  }));
  for (const ev of doItem) {
    if (ev.tipo === 'foto_anexada')
      passos.push({
        em: ev.em,
        rotulo: 'Foto anexada',
        detalhe: '',
        cor: 'neutra',
        pessoa: nomeCurto(ev.porNome) || null,
      });
  }
  const dia = diaVencida(item, hoje);
  if (dia) {
    const l = linhaVencida(item, dia, formatarData);
    passos.push({
      em: l.em,
      rotulo: ROTULO.vencida,
      detalhe: l.detalhe,
      cor: l.cor,
      pessoa: l.pessoa,
    });
  }
  passos.sort((a, b) => instante(a.em) - instante(b.em));

  const fim = item.concluidaEm ? diaLocal(item.concluidaEm) : hoje;
  const prazoOriginal = item.prazoOriginal ?? item.prazo;
  const alem = prazoOriginal ? atrasoDU(prazoOriginal, fim) : 0;
  const replanejamentos = doItem.filter(
    (ev) => ev.tipo === 'replanejada' || ev.tipo === 'inicio_ajustado',
  ).length;
  const ordenados = [...doItem].sort((a, b) => instante(a.em) - instante(b.em));
  // Nascimento: o evento de criação; fora da janela, a data de criação do item;
  // sem nenhuma das duas, o primeiro evento carregado.
  const nascimento =
    ordenados.find((ev) => ev.tipo === 'criada' || ev.tipo === 'apontada')?.em ??
    item.criadaEm ??
    ordenados[0]?.em;
  const aberta = nascimento ? Math.max(0, diasCorridos(diaLocal(nascimento), fim)) : 0;

  return {
    passos,
    resumo: [
      `${alem} d.u. além do prazo original`,
      plural(replanejamentos, 'replanejamento', 'replanejamentos'),
      plural(aberta, 'dia aberta', 'dias aberta'),
    ].join(' · '),
  };
}
