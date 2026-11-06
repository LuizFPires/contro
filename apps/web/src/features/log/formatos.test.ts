import { describe, expect, it } from 'vitest';
import { chaveFiltroLog, diaDe, horaDe } from './formatos';

describe('formatos do Log', () => {
  it('data pura fica como está e não tem hora', () => {
    expect(diaDe('2026-11-03')).toBe('2026-11-03');
    expect(horaDe('2026-11-03')).toBeNull();
  });
  it('instante vira dia e hora locais', () => {
    const em = new Date(2026, 10, 4, 9, 7).toISOString();
    expect(diaDe(em)).toBe('2026-11-04');
    expect(horaDe(em)).toBe('09:07');
  });
});

describe('chaveFiltroLog', () => {
  it('Contorno mantém as chaves de sempre; Obras gerais lembra à parte', () => {
    expect(chaveFiltroLog('contorno', 'obra')).toBe('log:obra');
    expect(chaveFiltroLog('contorno', 'eu')).toBe('log:eu');
    expect(chaveFiltroLog('geral', 'obra')).toBe('obrasgerais:log:obra');
    expect(chaveFiltroLog('geral', 'tipo')).toBe('obrasgerais:log:tipo');
  });
});
