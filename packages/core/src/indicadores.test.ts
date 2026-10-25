import { describe, expect, it } from 'vitest';
import { diasUteisRestantes, estaAtrasada, ritmoTexto } from './indicadores';

describe('ritmoTexto (SPEC §4.5)', () => {
  it('à frente com plural', () => {
    expect(ritmoTexto(3)).toEqual({ texto: '3 dias à frente do modelo', atrasada: false });
  });
  it('à frente no singular', () => {
    expect(ritmoTexto(1).texto).toBe('1 dia à frente do modelo');
  });
  it('no ritmo em 0 e -1', () => {
    expect(ritmoTexto(0).texto).toBe('No ritmo do modelo');
    expect(ritmoTexto(-1).texto).toBe('No ritmo do modelo');
    expect(ritmoTexto(0).atrasada).toBe(false);
  });
  it('atrasada em <= -2, em vermelho', () => {
    expect(ritmoTexto(-3)).toEqual({ texto: 'Atrasada · 3 dias', atrasada: true });
  });
  it('curto omite "do modelo"', () => {
    expect(ritmoTexto(3, true).texto).toBe('3 dias à frente');
    expect(ritmoTexto(0, true).texto).toBe('No ritmo');
  });
});

describe('estaAtrasada', () => {
  it('só <= -2', () => {
    expect(estaAtrasada(-1)).toBe(false);
    expect(estaAtrasada(-2)).toBe(true);
  });
});

describe('diasUteisRestantes', () => {
  it('total - decorridos, nunca negativo', () => {
    expect(diasUteisRestantes(10, 47)).toBe(37);
    expect(diasUteisRestantes(50, 47)).toBe(0);
  });
});
