import { describe, expect, it } from 'vitest';
import { aplicarOrdem, moverId } from './reordenar';

describe('moverId', () => {
  it('leva para baixo e para cima', () => {
    expect(moverId(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
    expect(moverId(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });
  it('sem mudança quando solta no mesmo lugar ou fora da lista', () => {
    const ids = ['a', 'b'];
    expect(moverId(ids, 'a', 'a')).toBe(ids);
    expect(moverId(ids, 'x', 'a')).toBe(ids);
    expect(moverId(ids, 'a', 'x')).toBe(ids);
  });
});

describe('aplicarOrdem', () => {
  it('numera pela posição e deixa os outros itens como estão', () => {
    const itens = [
      { id: 'a', ordem: 1 },
      { id: 'b', ordem: 2 },
      { id: 'c', ordem: 3 },
      { id: 'sub', ordem: 1 },
    ];
    expect(aplicarOrdem(itens, ['c', 'a', 'b'])).toEqual([
      { id: 'a', ordem: 2 },
      { id: 'b', ordem: 3 },
      { id: 'c', ordem: 1 },
      { id: 'sub', ordem: 1 },
    ]);
  });
});
