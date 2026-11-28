import { describe, expect, it } from 'vitest';
import { deltaInicioDU, mudarInicioObra } from './inicioObra';

const INICIO = '2026-11-10'; // terça
const atvs = [
  { id: 'A', duracao_du: 3 },
  { id: 'B', duracao_du: 2, predecessoras: ['A'], inicio_manual: '2026-11-17' }, // +5 du
];

describe('deltaInicioDU', () => {
  it('conta dias úteis com sinal', () => {
    expect(deltaInicioDU('2026-11-10', '2026-11-17')).toBe(5);
    expect(deltaInicioDU('2026-11-17', '2026-11-10')).toBe(-5);
    expect(deltaInicioDU(INICIO, INICIO)).toBe(0);
  });
});

describe('mudarInicioObra', () => {
  it('adiantar: a obra toda e as datas manuais andam juntas', () => {
    const m = mudarInicioObra(INICIO, '2026-11-03', atvs, [
      { id: 'p1', na_obra_em: '2026-11-12' },
      { id: 'p2', na_obra_em: null },
    ], '2026-11-18');
    expect(m.inicio).toBe('2026-11-03');
    expect(m.deltaDu).toBe(-5);
    expect(m.atividades).toEqual([{ id: 'B', inicio_manual: '2026-11-10' }]);
    expect(m.providencias).toEqual([{ id: 'p1', na_obra_em: '2026-11-05' }]);
    expect(m.entregaAntes).toBe('2026-11-18');
    expect(m.entregaDepois).toBe('2026-11-11');
    expect(m.entregaOriginal).toBe('2026-11-11');
  });

  it('data no fim de semana vira a segunda seguinte', () => {
    const m = mudarInicioObra(INICIO, '2026-11-14', atvs, []);
    expect(m.inicio).toBe('2026-11-16');
    expect(m.deltaDu).toBe(4);
  });

  it('mesma data: nada muda', () => {
    const m = mudarInicioObra(INICIO, INICIO, atvs, []);
    expect(m.deltaDu).toBe(0);
    expect(m.entregaDepois).toBe(m.entregaAntes);
    expect(m.entregaOriginal).toBeNull();
  });
});
