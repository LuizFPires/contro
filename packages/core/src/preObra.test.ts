import { describe, expect, it } from 'vitest';
import { deslocarDU } from './calendar';
import { calcularCronograma } from './schedule';
import { cronogramaPreObra } from './preObra';

const INICIO = '2026-11-02'; // segunda = dia 0 (início da Mobilização)
// Obra: Mob(2) -> Ar(6) começa no dia 2.
const cron = calcularCronograma({
  inicio: INICIO,
  atividades: [
    { id: 'mob', duracao_du: 2 },
    { id: 'ar', duracao_du: 6, predecessoras: ['mob'] },
  ],
});

describe('deslocarDU', () => {
  it('volta dias úteis pulando o fim de semana', () => {
    expect(deslocarDU('2026-11-02', -1)).toBe('2026-10-30');
    expect(deslocarDU('2026-11-02', -5)).toBe('2026-10-26');
    expect(deslocarDU('2026-11-02', 1)).toBe('2026-11-03');
  });
});

describe('cronogramaPreObra', () => {
  const pre = cronogramaPreObra(INICIO, cron, [
    // Orçamento: 3 atividades em sequência.
    { id: 'o1', duracao_du: 5 },
    { id: 'o2', duracao_du: 5, predecessoras: ['o1'] },
    { id: 'o3', duracao_du: 5, predecessoras: ['o2'] },
    // Equipamentos de ar: libera ar (ES 2) − 30 = dia −28.
    { id: 'm1', duracao_du: 5, mapaAlvos: ['ar'], mapaAntecedenciaDu: 30 },
    // Empreiteiro: libera mob (ES 0) e ar (ES 2) → vale a mais cedo: 0 − 3 = dia −3.
    { id: 'm2', duracao_du: 5, mapaAlvos: ['ar', 'mob'], mapaAntecedenciaDu: 3 },
  ]);

  it('mapa termina antes da mais cedo das atividades que libera', () => {
    expect(pre.m1).toMatchObject({ es: -33, ef: -28 });
    expect(pre.m2).toMatchObject({ es: -8, ef: -3 });
    expect(pre.m2.fim_previsto).toBe(deslocarDU(INICIO, -4));
  });

  it('Orçamento termina antes do primeiro mapa, na sequência #1 → #2 → #3', () => {
    expect(pre.o3).toMatchObject({ es: -38, ef: -33 });
    expect(pre.o2).toMatchObject({ es: -43, ef: -38 });
    expect(pre.o1).toMatchObject({ es: -48, ef: -43 });
    expect(pre.o1.inicio_previsto < pre.m1.inicio_previsto).toBe(true);
  });

  it('subitens seguem dentro da atividade', () => {
    const p = cronogramaPreObra(INICIO, cron, [
      { id: 'x', duracao_du: 10 },
      { id: 'x1', pai_id: 'x', duracao_du: 4, em_sequencia: true },
      { id: 'x2', pai_id: 'x', duracao_du: 6, em_sequencia: true },
    ]);
    expect(p.x).toMatchObject({ es: -10, ef: 0 });
    expect(p.x2).toMatchObject({ es: -6, ef: 0 });
  });
});
