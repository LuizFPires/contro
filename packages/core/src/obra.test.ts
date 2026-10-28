import { describe, it, expect } from 'vitest';
import { calcularCronograma } from './schedule';
import { diaDaObra, estadoObra, faseFechaCom, xpConclusao, type AtividadeFase } from './obra';

const INICIO = '2026-01-05'; // segunda

// Cronograma simples: A(2) -> B(3), total 5.
const cron = calcularCronograma({
  inicio: INICIO,
  atividades: [
    { id: 'A', duracao_du: 2 },
    { id: 'B', duracao_du: 3, predecessoras: ['A'] },
  ],
});
const todosProv = new Set(['A', 'B']); // sem providências pendentes

describe('estadoObra — sem atividade bloqueada', () => {
  it('toda atividade aberta pode ser concluída, mesmo com a predecessora aberta', () => {
    const e = estadoObra({
      inicio: INICIO,
      hoje: INICIO,
      cronograma: cron,
      concluidas: new Set(),
      provOk: todosProv,
    });
    expect(e.atividades.A.liberada).toBe(true);
    expect(e.atividades.B.liberada).toBe(true);
    expect(e.indicadores.real).toBe(0);
  });

  it('concluída deixa de estar aberta e conta no real', () => {
    const e = estadoObra({
      inicio: INICIO,
      hoje: INICIO,
      cronograma: cron,
      concluidas: new Set(['A']),
      provOk: todosProv,
    });
    expect(e.atividades.A.liberada).toBe(false);
    expect(e.indicadores.real).toBeCloseTo(0.4, 5); // 2/5
  });

  it('avanço parcial conta no real pelo peso da atividade', () => {
    const e = estadoObra({
      inicio: INICIO,
      hoje: INICIO,
      cronograma: cron,
      concluidas: new Set(['A']),
      provOk: todosProv,
      avanco: { A: 50, B: 50 },
    });
    // A concluída vale inteira (o avanço guardado não importa); B: metade de 3.
    expect(e.indicadores.real).toBeCloseTo((2 + 1.5) / 5, 5);
    expect(e.atividades.B.concluida).toBe(false);
  });

  it('lembrete pendente só avisa: a atividade continua aberta', () => {
    const e = estadoObra({
      inicio: INICIO,
      hoje: INICIO,
      cronograma: cron,
      concluidas: new Set(),
      provOk: new Set(['B']), // A com lembrete pendente
    });
    expect(e.atividades.A.liberada).toBe(true);
    expect(e.atividades.A.lembretesPendentes).toBe(true);
    expect(e.atividades.B.lembretesPendentes).toBe(false);
  });
});

describe('estadoObra — atraso e ritmo', () => {
  it('passado o EF sem concluir = atrasada', () => {
    const e = estadoObra({
      inicio: INICIO,
      hoje: '2026-01-12', // decorridos 5
      cronograma: cron,
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

describe('faseFechaCom / xpConclusao', () => {
  // Fase f1: A, B (topo) e B1 (subitem de B). Fase f2: C.
  const atvs: AtividadeFase[] = [
    { id: 'A', paiId: null, faseId: 'f1', concluida: true },
    { id: 'B', paiId: null, faseId: 'f1', concluida: false },
    { id: 'B1', paiId: 'B', faseId: 'f1', concluida: false },
    { id: 'C', paiId: null, faseId: 'f2', concluida: false },
  ];

  it('fecha a fase ao concluir a última de topo em aberto', () => {
    // Concluir B fecha f1 (A já concluída; B1 é subitem, não conta).
    expect(faseFechaCom('B', 'f1', atvs)).toBe(true);
  });

  it('não fecha a fase se sobra outra de topo em aberto', () => {
    // Concluir A não fecha: B ainda aberta.
    expect(faseFechaCom('A', 'f1', atvs)).toBe(false);
  });

  it('ignora atividades de outra fase', () => {
    expect(faseFechaCom('C', 'f2', atvs)).toBe(true);
  });

  it('XP: 50 por atividade, +200 ao fechar a fase', () => {
    expect(xpConclusao(false)).toBe(50);
    expect(xpConclusao(true)).toBe(250);
    // Mapa de coleta: só controle, sem pontos (nem ao fechar a fase).
    expect(xpConclusao(false, true)).toBe(0);
    expect(xpConclusao(true, true)).toBe(0);
  });
});
