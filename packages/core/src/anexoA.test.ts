import { describe, it, expect } from 'vitest';
import { CicloError, calcularCronograma } from './schedule';
import { MODELO_1, MODELO_2, MODELO_3, derivarModelo } from './modelos.fixture';

const INICIO = '2026-01-05'; // segunda

describe('Anexo A — Modelo 1 (CDC completo)', () => {
  const c = calcularCronograma({ inicio: INICIO, atividades: MODELO_1 });

  it('total = 54 dias úteis', () => {
    expect(c.total).toBe(54);
  });

  it('Demolições (atividade 2) tem dur 5 pelo vão dos subitens', () => {
    expect(c.porId['2'].dur).toBe(5);
  });

  it('o caminho crítico passa por 1,2,3,5,8,12,15,16,17,25,26,27,28', () => {
    const criticos = ['1', '2', '3', '5', '8', '12', '15', '16', '17', '25', '26', '27', '28'];
    for (const id of criticos) expect(c.porId[id].critico, `atividade ${id}`).toBe(true);
  });

  it('entrega = início + (54-1) dias úteis', () => {
    expect(c.entrega).toBe(c.porId['28'].fim_previsto);
  });
});

describe('Anexo A — Modelos derivados', () => {
  it('Modelo 2 (sem 10,13,18,19): 24 atividades de topo, calcula sem ciclo', () => {
    const topo = MODELO_2.filter((a) => !a.pai_id);
    expect(topo).toHaveLength(24);
    const c = calcularCronograma({ inicio: INICIO, atividades: MODELO_2 });
    expect(c.total).toBe(54); // o caminho crítico não passa pelas removidas
    // a atividade 11 herdou a predecessora de 10 (passou a depender só de 7)
    expect(MODELO_2.find((a) => a.id === '11')?.predecessoras).toEqual(['7']);
  });

  it('Modelo 3 (retrofit leve): demolição = 2 du e total menor que o Modelo 1', () => {
    const c = calcularCronograma({ inicio: INICIO, atividades: MODELO_3 });
    expect(c.porId['2'].dur).toBe(2); // "Retiradas pontuais"
    expect(c.total).toBeGreaterThan(0);
    expect(c.total).toBeLessThan(54);
  });
});

describe('Anexo A — robustez do motor', () => {
  it('rejeita ciclo introduzido no modelo', () => {
    const comCiclo = MODELO_1.map((a) => (a.id === '1' ? { ...a, predecessoras: ['3'] } : a)); // 1->3->2->1
    expect(() => calcularCronograma({ inicio: INICIO, atividades: comCiclo })).toThrow(CicloError);
  });

  it('inicio_manual na atividade 1 empurra todo o cronograma', () => {
    const base = calcularCronograma({ inicio: INICIO, atividades: MODELO_1 }).total;
    const empurrado = derivarModelo(MODELO_1, [], {
      '1': { inicio_manual: '2026-01-12' }, // +5 du
    });
    const c = calcularCronograma({ inicio: INICIO, atividades: empurrado });
    expect(c.total).toBe(base + 5);
  });
});
