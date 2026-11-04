import { describe, expect, it } from 'vitest';
import { iniciais, nomeCurto, nomeCurtoObra, normalizarNome, temNomeESobrenome } from './nomes';

describe('normalizarNome', () => {
  it('tira espaços sobrando, acentos e maiúsculas', () => {
    expect(normalizarNome(' Pinturas Sílva ')).toBe('pinturas silva');
    expect(normalizarNome('JOÃO   da  Conceição')).toBe('joao da conceicao');
    expect(normalizarNome('   ')).toBe('');
  });
});

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

describe('iniciais', () => {
  it('primeira letra do nome e do último sobrenome, sem partículas', () => {
    expect(iniciais('Thaina Costa')).toBe('TC');
    expect(iniciais('maria da silva')).toBe('MS');
    expect(iniciais('Pinturas Silva Ltda')).toBe('PL');
    expect(iniciais('João')).toBe('J');
    expect(iniciais('  ')).toBe('');
    expect(iniciais(null)).toBe('');
  });
});

describe('nomeCurtoObra', () => {
  it('tira o prefixo CDC', () => {
    expect(nomeCurtoObra('CDC - Juiz de Fora')).toBe('Juiz de Fora');
    expect(nomeCurtoObra('cdc – Ressaca')).toBe('Ressaca');
    expect(nomeCurtoObra("CDC Fall's")).toBe("CDC Fall's");
    expect(nomeCurtoObra('CDC - ')).toBe('CDC -');
  });
});
