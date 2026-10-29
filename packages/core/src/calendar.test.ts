import { describe, it, expect } from 'vitest';
import { addDU, diaUtilAPartir, duEntre, gradeDoMes, somarMeses } from './calendar';

// Semana de referência: seg 2026-01-05 … sex 2026-01-09, próxima seg 2026-01-12.

describe('addDU (dias úteis seg–sex)', () => {
  it('n=0 devolve a própria data', () => {
    expect(addDU('2026-01-05', 0)).toBe('2026-01-05');
  });
  it('avança dentro da semana', () => {
    expect(addDU('2026-01-05', 1)).toBe('2026-01-06');
    expect(addDU('2026-01-05', 4)).toBe('2026-01-09');
  });
  it('pula o fim de semana', () => {
    expect(addDU('2026-01-05', 5)).toBe('2026-01-12'); // seg -> próxima seg
    expect(addDU('2026-01-09', 1)).toBe('2026-01-12'); // sex +1 = seg
    expect(addDU('2026-01-09', 2)).toBe('2026-01-13'); // sex +2 = ter
  });
});

describe('duEntre [a, b)', () => {
  it('intervalo vazio é 0', () => {
    expect(duEntre('2026-01-05', '2026-01-05')).toBe(0);
  });
  it('conta dias úteis, b excluso', () => {
    expect(duEntre('2026-01-05', '2026-01-09')).toBe(4); // seg..qui
    expect(duEntre('2026-01-05', '2026-01-12')).toBe(5); // semana cheia
  });
  it('ignora o fim de semana', () => {
    expect(duEntre('2026-01-09', '2026-01-13')).toBe(2); // sex, seg
  });
});

describe('diaUtilAPartir', () => {
  it('dia útil fica; sábado e domingo vão para a segunda', () => {
    expect(diaUtilAPartir('2026-01-07')).toBe('2026-01-07');
    expect(diaUtilAPartir('2026-01-10')).toBe('2026-01-12');
    expect(diaUtilAPartir('2026-01-11')).toBe('2026-01-12');
  });
});

describe('gradeDoMes', () => {
  it('novembro de 2026: começa na segunda 26/10 e termina no domingo 06/12', () => {
    const g = gradeDoMes(2026, 11);
    expect(g).toHaveLength(6);
    expect(g[0][0]).toEqual({ data: '2026-10-26', doMes: false, fimDeSemana: false });
    expect(g[0][6]).toEqual({ data: '2026-11-01', doMes: true, fimDeSemana: true });
    expect(g[5][0].data).toBe('2026-11-30');
    expect(g[5][6]).toEqual({ data: '2026-12-06', doMes: false, fimDeSemana: true });
  });

  it('mês que começa na segunda não tem semana do mês anterior', () => {
    const g = gradeDoMes(2026, 6); // 01/06/2026 é segunda
    expect(g[0][0].data).toBe('2026-06-01');
    expect(g.every((s) => s.length === 7)).toBe(true);
  });

  it('somarMeses atravessa o ano', () => {
    expect(somarMeses(2026, 12, 1)).toEqual({ ano: 2027, mes: 1 });
    expect(somarMeses(2026, 1, -1)).toEqual({ ano: 2025, mes: 12 });
    expect(somarMeses(2026, 11, 0)).toEqual({ ano: 2026, mes: 11 });
  });
});
