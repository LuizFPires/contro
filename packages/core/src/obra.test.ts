import { describe, it, expect } from 'vitest';
import { calcularCronograma } from './schedule';
import { diaDaObra, estadoObra } from './obra';

const INICIO = '2026-01-05'; // segunda

// Cronograma simples: A(2) -> B(3), total 5.
const cron = calcularCronograma({
  inicio: INICIO,
  atividades: [
    { id: 'A', duracao_du: 2 },
    { id: 'B', duracao_du: 3, predecessoras: ['A'] },
  ],
});
const preds = { A: [], B: ['A'] };
const todosProv = new Set(['A', 'B']); // sem providências pendentes

describe('estadoObra — liberação', () => {
  it('no início: A liberada, B aguarda a predecessora', () => {
    const e = estadoObra({
      inicio: INICIO,
      hoje: INICIO,
      cronograma: cron,
      predecessoras: preds,
      concluidas: new Set(),
      provOk: todosProv,
    });
    expect(e.atividades.A.liberada).toBe(true);
    expect(e.atividades.B.liberada).toBe(false);
    expect(e.atividades.B.predsOk).toBe(false);
    expect(e.indicadores.real).toBe(0);
  });

  it('concluir A libera B', () => {
    const e = estadoObra({
      inicio: INICIO,
      hoje: INICIO,
      cronograma: cron,
      predecessoras: preds,
      concluidas: new Set(['A']),
      provOk: todosProv,
    });
    expect(e.atividades.B.liberada).toBe(true);
    expect(e.indicadores.real).toBeCloseTo(0.4, 5); // 2/5
  });

  it('sem providência: aguardando, não liberada', () => {
    const e = estadoObra({
      inicio: INICIO,
      hoje: INICIO,
      cronograma: cron,
      predecessoras: preds,
      concluidas: new Set(),
      provOk: new Set(['B']), // A sem providência feita
    });
    expect(e.atividades.A.liberada).toBe(false);
    expect(e.atividades.A.aguardandoProvidencia).toBe(true);
  });
});

describe('estadoObra — atraso e ritmo', () => {
  it('passado o EF sem concluir = atrasada', () => {
    const e = estadoObra({
      inicio: INICIO,
      hoje: '2026-01-12', // decorridos 5
      cronograma: cron,
      predecessoras: preds,
      concluidas: new Set(),
      provOk: todosProv,
    });
    expect(e.indicadores.decorridos).toBe(5);
    expect(e.atividades.A.atrasada).toBe(true);
    expect(e.atividades.B.atrasada).toBe(true);
  });

  it('ritmo negativo quando o real fica abaixo do previsto', () => {
    const e = estadoObra({
      inicio: INICIO,
      hoje: '2026-01-07', // decorridos 2
      cronograma: cron,
      predecessoras: preds,
      concluidas: new Set(),
      provOk: todosProv,
    });
    expect(e.indicadores.previstoHoje).toBeCloseTo(0.4, 5); // A deveria estar 100%
    expect(e.indicadores.ritmoDias).toBe(-2);
  });

  it('não iniciada: decorridos 0, nada atrasado', () => {
    const e = estadoObra({
      inicio: INICIO,
      hoje: '2026-01-01', // antes do início
      cronograma: cron,
      predecessoras: preds,
      concluidas: new Set(),
      provOk: todosProv,
    });
    expect(e.indicadores.decorridos).toBe(0);
    expect(e.indicadores.iniciada).toBe(false);
    expect(e.atividades.A.atrasada).toBe(false);
  });
});

describe('diaDaObra', () => {
  it('Dia N de M', () => {
    expect(diaDaObra(INICIO, '2026-01-07', 5)).toEqual({ n: 3, m: 5 }); // decorridos 2 -> dia 3
    expect(diaDaObra(INICIO, INICIO, 5)).toEqual({ n: 1, m: 5 });
  });
});
