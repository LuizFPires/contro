import { describe, expect, it } from 'vitest';
import { simularAjuste } from './ajusteObra';

const INICIO = '2026-11-02'; // segunda
// A(3) -> B(4) -> C(2). Total 9.
const atvs = [
  { id: 'A', duracao_du: 3 },
  { id: 'B', duracao_du: 4, predecessoras: ['A'] },
  { id: 'C', duracao_du: 2, predecessoras: ['B'] },
];

describe('simularAjuste', () => {
  it('sem mudança: mesma entrega e sem início manual', () => {
    const s = simularAjuste(INICIO, atvs, {
      id: 'B',
      duracao_du: 4,
      esManual: null,
      predecessoras: ['A'],
    });
    expect(s).toMatchObject({ es: 3, ef: 7, esMinimo: 3, inicioManual: null, deltaEntrega: 0 });
  });

  it('mais um dia de duração empurra a entrega', () => {
    const s = simularAjuste(INICIO, atvs, {
      id: 'B',
      duracao_du: 5,
      esManual: null,
      predecessoras: ['A'],
    });
    expect(s.deltaEntrega).toBe(1);
    expect(s.entregaDepois > s.entregaAntes).toBe(true);
  });

  it('início manual depois do mais cedo vira data e empurra a sucessora', () => {
    const s = simularAjuste(INICIO, atvs, {
      id: 'B',
      duracao_du: 4,
      esManual: 5,
      predecessoras: ['A'],
    });
    expect(s).toMatchObject({ es: 5, ef: 9, inicioManual: '2026-11-09', deltaEntrega: 2 });
    expect(s.cronograma.porId.C.es).toBe(9);
  });

  it('início manual antes do mais cedo é ignorado (predecessoras mandam)', () => {
    const s = simularAjuste(INICIO, atvs, {
      id: 'B',
      duracao_du: 4,
      esManual: 1,
      predecessoras: ['A'],
    });
    expect(s).toMatchObject({ es: 3, inicioManual: null });
  });

  it('tirar a predecessora adianta a atividade e a entrega', () => {
    const s = simularAjuste(INICIO, atvs, {
      id: 'B',
      duracao_du: 4,
      esManual: null,
      predecessoras: [],
    });
    expect(s).toMatchObject({ es: 0, esMinimo: 0, deltaEntrega: -3 });
  });
});
