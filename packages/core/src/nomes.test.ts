import { describe, expect, it } from 'vitest';
import { nomeCurto, temNomeESobrenome } from './nomes';

describe('nomeCurto', () => {
  it('primeiro nome + inicial do sobrenome', () => {
    expect(nomeCurto('Matheus Teófilo')).toBe('Matheus T');
    expect(nomeCurto('  Rodrigo   Menezes Lima ')).toBe('Rodrigo M');
    expect(nomeCurto('Luiz F')).toBe('Luiz F');
  });
  it('pula partículas (da, de, dos…) e lida com nome único ou vazio', () => {
    expect(nomeCurto('Maria da Silva')).toBe('Maria S');
    expect(nomeCurto('Paulo')).toBe('Paulo');
    expect(nomeCurto(null)).toBe('');
  });
});

describe('temNomeESobrenome', () => {
  it('exige duas palavras', () => {
    expect(temNomeESobrenome('Luiz Felipe')).toBe(true);
    expect(temNomeESobrenome('Luiz')).toBe(false);
    expect(temNomeESobrenome('Luiz 2')).toBe(false);
  });
});
