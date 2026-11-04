import { describe, expect, it } from 'vitest';
import { todasAsPaginas } from './paginas';

/** Consulta falsa: devolve os tamanhos de página dados, em ordem, e anota os ranges. */
function falsa(tamanhos: number[]) {
  const ranges: [number, number][] = [];
  let i = 0;
  const pagina = (de: number, ate: number) => {
    ranges.push([de, ate]);
    const n = tamanhos[i++] ?? 0;
    return Promise.resolve({ data: Array.from({ length: n }, (_, k) => de + k), error: null });
  };
  return { pagina, ranges };
}

describe('todasAsPaginas', () => {
  it('junta as páginas até vir uma curta (1000 + 1000 + 3)', async () => {
    const { pagina, ranges } = falsa([1000, 1000, 3]);
    const linhas = await todasAsPaginas(pagina);
    expect(linhas).toHaveLength(2003);
    expect(linhas[2002]).toBe(2002);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('para depois de uma página só quando ela vem curta (999)', async () => {
    const { pagina, ranges } = falsa([999]);
    expect(await todasAsPaginas(pagina)).toHaveLength(999);
    expect(ranges).toHaveLength(1);
  });

  it('página cheia seguida de vazia termina sem erro', async () => {
    const { pagina, ranges } = falsa([1000, 0]);
    expect(await todasAsPaginas(pagina)).toHaveLength(1000);
    expect(ranges).toHaveLength(2);
  });

  it('erro da consulta é lançado', async () => {
    const erro = new Error('falhou');
    await expect(todasAsPaginas(() => Promise.resolve({ data: null, error: erro }))).rejects.toBe(
      erro,
    );
  });
});
