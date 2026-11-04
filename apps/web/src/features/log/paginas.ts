// O PostgREST corta toda resposta em max_rows (1000 por padrão; .limit maior
// não adianta). Para tabelas que crescem com a instalação, lê página a página
// com .range até vir uma página curta. A consulta precisa de ordem estável.

export const TAMANHO_PAGINA = 1000;

export interface RespostaPagina<T> {
  data: T[] | null;
  error: unknown;
}

/**
 * Lê todas as páginas de uma consulta. `pagina(de, ate)` monta a consulta
 * (com ordem estável) e aplica `.range(de, ate)`. As páginas vão em sequência.
 */
export async function todasAsPaginas<T>(
  pagina: (de: number, ate: number) => PromiseLike<RespostaPagina<T>>,
  tamanho = TAMANHO_PAGINA,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await pagina(de, de + tamanho - 1);
    if (error) throw error;
    const lote = data ?? [];
    linhas.push(...lote);
    if (lote.length < tamanho) return linhas;
  }
}
