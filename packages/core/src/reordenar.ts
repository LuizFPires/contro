/**
 * Arrastar e soltar: leva `id` para a posição de `alvo` na lista. Sem mudança (mesmo id,
 * id fora da lista), devolve a mesma lista.
 */
export function moverId(ids: string[], id: string, alvo: string): string[] {
  const de = ids.indexOf(id);
  const para = ids.indexOf(alvo);
  if (de < 0 || para < 0 || de === para) return ids;
  const r = ids.slice();
  r.splice(de, 1);
  r.splice(para, 0, id);
  return r;
}

/**
 * Aplica a nova ordem (1..n pela posição em `ids`) aos itens listados; os outros ficam
 * como estão. Usada para mostrar a ordem nova antes de o servidor responder.
 */
export function aplicarOrdem<T extends { id: string; ordem: number }>(
  itens: T[],
  ids: string[],
): T[] {
  const pos = new Map(ids.map((id, i) => [id, i + 1]));
  return itens.map((it) => {
    const o = pos.get(it.id);
    return o === undefined || o === it.ordem ? it : { ...it, ordem: o };
  });
}
