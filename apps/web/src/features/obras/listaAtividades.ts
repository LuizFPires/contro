import { filtrarAtividades, normalizarBusca } from '@contro/core';
import type { ObraAtv, ObraCompleta, ObraFase } from './detalhe';
import { numeracaoObra } from './numeracaoObra';

/** O que a lista de atividades lê: serve para a obra Contorno e para a obra geral. */
export type ObraListavel = {
  fases: Pick<ObraFase, 'id' | 'ordem' | 'titulo'>[];
  atividades: Pick<ObraAtv, 'id' | 'nome' | 'pai_id' | 'fase_id' | 'ordem'>[];
};

/** O que o Check list lê da obra (Contorno ou geral). */
export type ObraChecklist = ObraListavel & { id: string; nome: string };

/** Atividade de topo numa lista de escolha (com o #N da obra), na ordem das fases. */
export interface ItemLista {
  id: string;
  nome: string;
  numero: number | null;
  faseId: string;
}

/** Atividades de topo da obra, fase a fase, com a numeração #N. */
export function itensAtividadesObra(obra: ObraListavel): ItemLista[] {
  const num = numeracaoObra(obra);
  const ordemFase = new Map(obra.fases.map((f) => [f.id, f.ordem]));
  const chave = (a: { fase_id: string; ordem: number }) =>
    (ordemFase.get(a.fase_id) ?? 0) * 10000 + a.ordem;
  return obra.atividades
    .filter((a) => !a.pai_id)
    .sort((x, y) => chave(x) - chave(y))
    .map((a) => ({ id: a.id, nome: a.nome, numero: num.get(a.id) ?? null, faseId: a.fase_id }));
}

/** Agrupa os itens pelas fases da obra (na ordem), sem grupos vazios. */
export function agruparPorFase<
  F extends Pick<ObraFase, 'id' | 'ordem'>,
  T extends { faseId: string },
>(fases: F[], itens: T[]): { fase: F; itens: T[] }[] {
  return fases
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((fase) => ({ fase, itens: itens.filter((a) => a.faseId === fase.id) }))
    .filter((g) => g.itens.length > 0);
}

/** Fase de pré-obra do Mapa de coleta (o título começa com "Mapa"). */
export function ehFaseMapa(fase: Pick<ObraFase, 'preliminar' | 'titulo'>): boolean {
  return fase.preliminar && /^mapa/i.test(fase.titulo.trim());
}

/**
 * Atividades que um item do mapa pode liberar: as de topo das fases da obra
 * (fora do pré-obra) ainda não concluídas, filtradas pela busca (nome sem
 * acento ou #N).
 */
export function alvosMapa(obra: ObraCompleta, busca = ''): ItemLista[] {
  const pre = new Set(obra.fases.filter((f) => f.preliminar).map((f) => f.id));
  const abertas = new Set(
    obra.atividades.filter((a) => !a.pai_id && !a.concluida_em).map((a) => a.id),
  );
  const itens = itensAtividadesObra(obra).filter((a) => !pre.has(a.faseId) && abertas.has(a.id));
  return filtrarAtividades(itens, busca);
}

/** Nomes dos itens do mapa já existentes na obra, sem repetição, em ordem alfabética. */
export function nomesItensMapa(obra: ObraCompleta): string[] {
  const mapa = new Set(obra.fases.filter(ehFaseMapa).map((f) => f.id));
  const vistos = new Map<string, string>();
  for (const a of obra.atividades) {
    if (a.pai_id || !mapa.has(a.fase_id)) continue;
    const nome = a.nome.trim().replace(/\s+/g, ' ');
    const chave = normalizarBusca(nome);
    if (nome && !vistos.has(chave)) vistos.set(chave, nome);
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
