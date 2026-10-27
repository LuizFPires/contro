import { describe, expect, it } from 'vitest';
import { dependenciasAtivas } from './dependencias';

const d = (a: string, p: string, defasagem_du = 0) => ({
  atividade_id: a,
  predecessora_id: p,
  defasagem_du,
});

describe('dependenciasAtivas', () => {
  it('sem exclusão, devolve as mesmas', () => {
    const deps = [d('b', 'a', -2), d('c', 'b')];
    expect(dependenciasAtivas(deps, new Set(['a', 'b', 'c']))).toEqual(deps);
  });

  it('sucessora herda as predecessoras da excluída (A → B → C, sem B: A → C)', () => {
    expect(dependenciasAtivas([d('b', 'a'), d('c', 'b', -1)], new Set(['a', 'c']))).toEqual([
      d('c', 'a'),
    ]);
  });

  it('cadeia de excluídas e sem repetir', () => {
    const deps = [d('b', 'a'), d('c', 'b'), d('e', 'c'), d('e', 'a')];
    expect(dependenciasAtivas(deps, new Set(['a', 'e']))).toEqual([d('e', 'a')]);
  });

  it('dependências da própria excluída somem', () => {
    expect(dependenciasAtivas([d('b', 'a')], new Set(['a']))).toEqual([]);
  });
});
