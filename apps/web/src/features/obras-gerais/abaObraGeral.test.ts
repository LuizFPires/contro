import { describe, expect, it } from 'vitest';
import { obraDaAbaGeral } from './abaObraGeral';

describe('obraDaAbaGeral', () => {
  it('com uma obra só, mostra ela mesmo sem nenhuma lembrada', () => {
    expect(obraDaAbaGeral([{ id: 'a' }], null)).toBe('a');
    expect(obraDaAbaGeral([{ id: 'a' }], 'x')).toBe('a');
  });
  it('com mais de uma, mostra a última aberta', () => {
    expect(obraDaAbaGeral([{ id: 'a' }, { id: 'b' }], 'b')).toBe('b');
  });
  it('com mais de uma e nenhuma aberta (ou a lembrada sumiu), mostra a lista', () => {
    expect(obraDaAbaGeral([{ id: 'a' }, { id: 'b' }], null)).toBeNull();
    expect(obraDaAbaGeral([{ id: 'a' }, { id: 'b' }], 'x')).toBeNull();
  });
  it('sem obras, mostra a lista', () => {
    expect(obraDaAbaGeral([], 'a')).toBeNull();
  });
});
