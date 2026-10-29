// Várias pendências de uma vez (pedido do usuário, 29/10/2026): no Check list, a
// câmera tira várias fotos seguidas ou importa várias da galeria; cada foto vira
// uma pendência. "Para todas as fotos" preenche local, criticidade e atividade
// de uma vez; "Apontar" grava as prontas e mantém as outras na lista.

import type { Criticidade } from './pendencias';

export interface ItemLote {
  id: string;
  titulo: string;
  local: string;
  criticidade: Criticidade;
  atividadeId: string | null;
}

/** Pronta para apontar: tem "o que é". */
export function itemPronto(it: Pick<ItemLote, 'titulo'>): boolean {
  return it.titulo.trim().length > 0;
}

/** Aplica a todas as fotos os campos informados (os ausentes ficam como estão). */
export function aplicarATodas<T extends ItemLote>(
  itens: T[],
  campos: Partial<Pick<ItemLote, 'local' | 'criticidade' | 'atividadeId'>>,
): T[] {
  return itens.map((it) => ({
    ...it,
    ...(campos.local !== undefined ? { local: campos.local } : {}),
    ...(campos.criticidade !== undefined ? { criticidade: campos.criticidade } : {}),
    ...(campos.atividadeId !== undefined ? { atividadeId: campos.atividadeId } : {}),
  }));
}

export function separarProntos<T extends ItemLote>(itens: T[]): { prontos: T[]; faltam: T[] } {
  return { prontos: itens.filter(itemPronto), faltam: itens.filter((it) => !itemPronto(it)) };
}

/** Texto do botão: "Apontar 3 pendências", "Apontar 1 pronta · faltam 2". */
export function textoApontarLote(prontos: number, faltam: number): string {
  if (prontos === 0) return 'Descreva ao menos uma foto';
  if (faltam === 0) return prontos === 1 ? 'Apontar pendência' : `Apontar ${prontos} pendências`;
  return `Apontar ${prontos} ${prontos === 1 ? 'pronta' : 'prontas'} · ${
    faltam === 1 ? 'falta 1' : `faltam ${faltam}`
  }`;
}

/** Card aberto na lista: o escolhido, se ainda existir; senão o primeiro sem descrição. */
export function cardAberto(itens: ItemLote[], escolhido: string | null): string | null {
  if (escolhido && itens.some((it) => it.id === escolhido)) return escolhido;
  return itens.find((it) => !itemPronto(it))?.id ?? null;
}
