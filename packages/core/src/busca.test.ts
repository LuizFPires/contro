import { describe, expect, it } from 'vitest';
import { filtrarAtividades, normalizarBusca } from './busca';

const lista = [
  { id: 'a', nome: 'Infra de elétrica', numero: 24 },
  { id: 'b', nome: 'Infra hidráulica', numero: 23 },
  { id: 'c', nome: 'Pintura', numero: 4 },
  { id: 'd', nome: 'Forro de gesso', numero: null },
];

describe('busca de atividade', () => {
  it('normaliza acento, caixa e espaços', () => {
    expect(normalizarBusca('  Infra   de ELÉTRICA ')).toBe('infra de eletrica');
  });

  it('termo vazio devolve tudo, na ordem', () => {
    expect(filtrarAtividades(lista, '   ').map((a) => a.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('acha por parte do nome, sem acento', () => {
    expect(filtrarAtividades(lista, 'eletrica').map((a) => a.id)).toEqual(['a']);
    expect(filtrarAtividades(lista, 'infra').map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('palavras em qualquer ordem', () => {
    expect(filtrarAtividades(lista, 'eletrica infra').map((a) => a.id)).toEqual(['a']);
  });

  it('acha pelo número, com ou sem #', () => {
    expect(filtrarAtividades(lista, '24').map((a) => a.id)).toEqual(['a']);
    expect(filtrarAtividades(lista, '#4').map((a) => a.id)).toEqual(['c']);
  });

  it('sem resultado devolve lista vazia', () => {
    expect(filtrarAtividades(lista, 'telhado')).toEqual([]);
  });
});
