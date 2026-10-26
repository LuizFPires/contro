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
    { id: 'orc', duracao_du: 15 },
    { id: 's1', pai_id: 'orc', duracao_du: 5, em_sequencia: true },
    { id: 's2', pai_id: 'orc', duracao_du: 5, em_sequencia: true },
    { id: 's3', pai_id: 'orc', duracao_du: 5, em_sequencia: true },
    // Equipamentos de ar: contratar até ES(ar)=2 − 30 = dia −28.
    { id: 'm1', duracao_du: 5, mapaAlvoId: 'ar', mapaAntecedenciaDu: 30 },
    // Locações: contratar até ES(mob)=0 − 3 = dia −3.
    { id: 'm2', duracao_du: 5, mapaAlvoId: 'mob', mapaAntecedenciaDu: 3 },
  ]);

  it('mapa termina quando a contratação precisa estar fechada', () => {
    expect(pre.m1).toMatchObject({ es: -33, ef: -28 });
    expect(pre.m2).toMatchObject({ es: -8, ef: -3 });
    expect(pre.m2.fim_previsto).toBe(deslocarDU(INICIO, -4));
  });

  it('Orçamento termina antes do primeiro mapa e os subitens seguem em sequência', () => {
    expect(pre.orc).toMatchObject({ es: -48, ef: -33 });
    expect(pre.s1).toMatchObject({ es: -48, ef: -43 });
    expect(pre.s3).toMatchObject({ es: -38, ef: -33 });
    expect(pre.orc.inicio_previsto < pre.m1.inicio_previsto).toBe(true);
  });
});
