import { describe, expect, it } from 'vitest';
import { formatarDataCompleta, formatarDataCurta, formatarDiaSemana } from './datas';

describe('datas', () => {
  it('formata curta, completa e o dia do Log', () => {
    expect(formatarDataCurta('2026-11-04')).toBe('qua 04/11');
    expect(formatarDataCompleta('2026-12-03')).toBe('quinta, 03/12/2026');
    expect(formatarDiaSemana('2026-11-04')).toBe('Quarta, 04/11');
    expect(formatarDiaSemana('2026-11-08')).toBe('Domingo, 08/11');
  });
});
