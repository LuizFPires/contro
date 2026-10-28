import { describe, expect, it } from 'vitest';
import {
  PASSOS_AVANCO,
  avancoAoTocarCard,
  normalizarAvanco,
  proximoAvancoAnel,
  textoAvanco,
} from './avanco';

describe('avanço parcial', () => {
  it('passos do anel e dos cards', () => {
    expect(PASSOS_AVANCO).toEqual([25, 50, 75, 100]);
  });

  it('cada toque no anel soma 25% e o quarto conclui', () => {
    expect(proximoAvancoAnel(0)).toBe(25);
    expect(proximoAvancoAnel(25)).toBe(50);
    expect(proximoAvancoAnel(50)).toBe(75);
    expect(proximoAvancoAnel(75)).toBe(100);
  });

  it('valor fora dos passos vai ao próximo passo acima', () => {
    expect(proximoAvancoAnel(10)).toBe(25);
    expect(proximoAvancoAnel(60)).toBe(75);
    expect(proximoAvancoAnel(99)).toBe(100);
  });

  it('card marca o passo; tocar no mesmo volta um passo', () => {
    expect(avancoAoTocarCard(0, 75)).toBe(75);
    expect(avancoAoTocarCard(50, 25)).toBe(25);
    expect(avancoAoTocarCard(50, 50)).toBe(25);
    expect(avancoAoTocarCard(25, 25)).toBe(0);
    expect(avancoAoTocarCard(50, 100)).toBe(100);
    expect(avancoAoTocarCard(100, 100)).toBe(75);
  });

  it('normaliza valores do banco ou do cache', () => {
    expect(normalizarAvanco(null)).toBe(0);
    expect(normalizarAvanco(undefined)).toBe(0);
    expect(normalizarAvanco(-5)).toBe(0);
    expect(normalizarAvanco(140)).toBe(100);
    expect(normalizarAvanco(49.6)).toBe(50);
  });

  it('texto só para o parcial', () => {
    expect(textoAvanco(0)).toBe('');
    expect(textoAvanco(50)).toBe('50% feito');
    expect(textoAvanco(100)).toBe('');
  });
});
