import { describe, expect, it } from 'vitest';
import { antecedenciaLembrete } from './antecedenciaLembrete';

describe('antecedenciaLembrete', () => {
  it('vazio vale o padrão de 5 dias úteis (não 0)', () => {
    expect(antecedenciaLembrete('')).toBe(5);
    expect(antecedenciaLembrete('  ')).toBe(5);
  });
  it('aceita de 0 a 60', () => {
    expect(antecedenciaLembrete('0')).toBe(0);
    expect(antecedenciaLembrete('12')).toBe(12);
    expect(antecedenciaLembrete('60')).toBe(60);
  });
  it('acima de 60 ou não numérico é inválido', () => {
    expect(antecedenciaLembrete('61')).toBeNull();
    expect(antecedenciaLembrete('5a')).toBeNull();
  });
});
