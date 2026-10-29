import { describe, expect, it } from 'vitest';
import {
  aplicarATodas,
  cardAberto,
  itemPronto,
  separarProntos,
  textoApontarLote,
  type ItemLote,
} from './loteFotos';

const item = (id: string, titulo = ''): ItemLote => ({
  id,
  titulo,
  local: '',
  criticidade: 'media',
  atividadeId: null,
});

describe('várias pendências de uma vez', () => {
  it('pronta é a que tem "o que é"', () => {
    expect(itemPronto(item('a', 'Rejunte faltando'))).toBe(true);
    expect(itemPronto(item('a', '   '))).toBe(false);
  });

  it('para todas as fotos: só os campos informados', () => {
    const itens = [{ ...item('a', 'X'), local: 'Recepção' }, item('b')];
    const r = aplicarATodas(itens, { criticidade: 'alta', atividadeId: 'atv' });
    expect(r.map((x) => [x.local, x.criticidade, x.atividadeId, x.titulo])).toEqual([
      ['Recepção', 'alta', 'atv', 'X'],
      ['', 'alta', 'atv', ''],
    ]);
    expect(aplicarATodas(itens, { local: 'Vestiário' }).map((x) => x.local)).toEqual([
      'Vestiário',
      'Vestiário',
    ]);
  });

  it('aponta as prontas e mantém as outras', () => {
    const { prontos, faltam } = separarProntos([item('a', 'X'), item('b'), item('c', 'Y')]);
    expect(prontos.map((x) => x.id)).toEqual(['a', 'c']);
    expect(faltam.map((x) => x.id)).toEqual(['b']);
  });

  it('texto do botão', () => {
    expect(textoApontarLote(0, 3)).toBe('Descreva ao menos uma foto');
    expect(textoApontarLote(1, 0)).toBe('Apontar pendência');
    expect(textoApontarLote(3, 0)).toBe('Apontar 3 pendências');
    expect(textoApontarLote(1, 2)).toBe('Apontar 1 pronta · faltam 2');
    expect(textoApontarLote(2, 1)).toBe('Apontar 2 prontas · falta 1');
  });

  it('card aberto: o escolhido ou o primeiro sem descrição', () => {
    const itens = [item('a', 'X'), item('b'), item('c')];
    expect(cardAberto(itens, null)).toBe('b');
    expect(cardAberto(itens, 'a')).toBe('a');
    expect(cardAberto(itens, 'sumiu')).toBe('b');
    expect(cardAberto([item('a', 'X')], null)).toBeNull();
  });
});
