// Log e Score das obras gerais: atividades de topo (data prevista digitada, sem
// cronograma) no formato de itens do Log e do Score da equipe. Puro: recebe as
// atividades, os nomes das pessoas e os eventos já carregados.
import type { ItemLog } from './log';
import {
  filhosPorPai,
  prazoAtividadeGeral,
  prazoOriginalAtividadeGeral,
  type AtividadeGeral,
} from './obraGeral';
import { replanejamentosPorEventos, type ItemEquipe } from './score';

export interface EntradaObraGeralLog {
  obraId: string;
  obraNome: string;
  /** Atividades não excluídas da obra (topo e subitens). */
  atividades: AtividadeGeral[];
  /** Nome por id de pessoa. */
  nomes: Record<string, string>;
}

/**
 * Itens do Log: atividades de topo, com a data prevista efetiva como prazo (a maior
 * dos subitens, ou a própria) e o responsável direto. `criadaEm` é o nascimento
 * das atividades quando o evento de criação está fora da janela carregada.
 */
export function itensLogObraGeral(
  e: EntradaObraGeralLog & { criadaEm?: string | null },
): ItemLog[] {
  const filhos = filhosPorPai(e.atividades);
  const itens: ItemLog[] = [];
  for (const a of e.atividades) {
    if (a.pai_id !== null) continue;
    const subs = filhos.get(a.id) ?? [];
    itens.push({
      origem: 'atividade',
      id: a.id,
      obraId: e.obraId,
      obraNome: e.obraNome,
      texto: a.nome,
      prazo: prazoAtividadeGeral(a, subs),
      prazoOriginal: prazoOriginalAtividadeGeral(a, subs),
      aberta: a.concluida_em === null,
      concluidaEm: a.concluida_em,
      responsavelNome: a.responsavel_id ? (e.nomes[a.responsavel_id] ?? null) : null,
      responsavelId: a.responsavel_id,
      criadaEm: e.criadaEm ?? null,
      excluida: false,
      semCronograma: true,
    });
  }
  return itens;
}

/**
 * Itens do Score da equipe: atividades de topo com responsável e data prevista
 * (prazo = data prevista efetiva; original = `prazoOriginalAtividadeGeral`).
 * Replanejamentos pelos eventos `replanejada` não desfeitos da atividade e dos
 * subitens dela (a data dos subitens forma o prazo da atividade); o contador da
 * coluna não é usado.
 */
export function itensEquipeObraGeral(
  e: EntradaObraGeralLog & {
    eventos: { id: string; itemId: string; tipo: string; depois: unknown }[];
  },
): ItemEquipe[] {
  const filhos = filhosPorPai(e.atividades);
  const topoDe = new Map<string, string>();
  for (const a of e.atividades) topoDe.set(a.id, a.pai_id ?? a.id);
  const porAtividade = replanejamentosPorEventos(e.eventos);
  const replanejamentos = new Map<string, number>();
  for (const [id, n] of Object.entries(porAtividade)) {
    const topo = topoDe.get(id);
    if (topo) replanejamentos.set(topo, (replanejamentos.get(topo) ?? 0) + n);
  }

  const itens: ItemEquipe[] = [];
  for (const a of e.atividades) {
    if (a.pai_id !== null || !a.responsavel_id) continue;
    const subs = filhos.get(a.id) ?? [];
    const prazo = prazoAtividadeGeral(a, subs);
    const prazoOriginal = prazoOriginalAtividadeGeral(a, subs);
    if (!prazo || !prazoOriginal) continue;
    itens.push({
      id: a.id,
      origem: 'atividade',
      obraId: e.obraId,
      obraNome: e.obraNome,
      texto: a.nome,
      chavePessoa: a.responsavel_id,
      nomePessoa: e.nomes[a.responsavel_id] ?? '',
      prazo,
      prazoOriginal,
      concluidaEm: a.concluida_em,
      replanejamentos: replanejamentos.get(a.id) ?? 0,
      excluida: false,
    });
  }
  return itens;
}
