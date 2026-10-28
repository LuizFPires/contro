// Busca de atividade por texto (pedido do usuário, 28/10/2026): no Check list, ao
// relacionar a pendência a uma atividade, a pessoa digita parte do nome ou o
// número ("24", "#24") em vez de rolar uma lista longa.

/** Minúsculas, sem acento e com espaços simples, para comparar textos. */
export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface ItemBusca {
  nome: string;
  /** Número da atividade na obra (#N), quando houver. */
  numero?: number | null;
}

/**
 * Filtra mantendo a ordem. Termo vazio devolve tudo. Número ("24" ou "#24")
 * casa com o #N exato; texto casa quando todas as palavras aparecem no nome,
 * em qualquer ordem ("eletrica infra" acha "Infra de elétrica").
 */
export function filtrarAtividades<T extends ItemBusca>(lista: T[], termo: string): T[] {
  const t = normalizarBusca(termo);
  if (!t) return lista;
  const num = /^#?(\d+)$/.exec(t);
  if (num) {
    const n = Number(num[1]);
    return lista.filter((a) => a.numero === n || normalizarBusca(a.nome).includes(num[1]));
  }
  const palavras = t.replace(/#/g, '').split(' ').filter(Boolean);
  return lista.filter((a) => {
    const nome = normalizarBusca(a.nome);
    return palavras.every((p) => nome.includes(p));
  });
}
