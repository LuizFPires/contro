import { describe, it, expect } from 'vitest';
import {
  CicloError,
  calcularCronograma,
  durAtividade,
  durSubitens,
  ordenarTopologico,
  peso,
  type AtividadeEntrada,
} from './schedule';

const INICIO = '2026-01-05'; // segunda

describe('subitens (vão)', () => {
  it('Demolições: paralelo + sequência = 5 du', () => {
    const subs: AtividadeEntrada[] = [
      { id: '2.1', duracao_du: 2, pai_id: '2', em_sequencia: true }, // início
      { id: '2.2', duracao_du: 2, pai_id: '2', em_sequencia: false }, // paralelo
      { id: '2.3', duracao_du: 3, pai_id: '2', em_sequencia: true }, // em sequência
    ];
    expect(durSubitens(subs)).toBe(5);
    expect(durAtividade({ id: '2', duracao_du: 99 }, subs)).toBe(5);
  });

  it('só sequência soma; só paralelo é o maior', () => {
    expect(
      durSubitens([
        { id: 'a', duracao_du: 2, em_sequencia: true },
        { id: 'b', duracao_du: 3, em_sequencia: true },
      ]),
    ).toBe(5);
    expect(
      durSubitens([
        { id: 'a', duracao_du: 2, em_sequencia: false },
        { id: 'b', duracao_du: 3, em_sequencia: false },
      ]),
    ).toBe(3);
  });

  it('sem subitens usa duracao_du', () => {
    expect(durAtividade({ id: 'x', duracao_du: 7 }, [])).toBe(7);
  });
});

describe('ordenação topológica e ciclo', () => {
  it('ordena predecessora antes da sucessora', () => {
    const ordem = ordenarTopologico([
      { id: 'B', duracao_du: 1, predecessoras: ['A'] },
      { id: 'A', duracao_du: 1 },
    ]).map((a) => a.id);
    expect(ordem.indexOf('A')).toBeLessThan(ordem.indexOf('B'));
  });

  it('rejeita ciclo com CicloError', () => {
    expect(() =>
      ordenarTopologico([
        { id: 'A', duracao_du: 1, predecessoras: ['B'] },
        { id: 'B', duracao_du: 1, predecessoras: ['A'] },
      ]),
    ).toThrow(CicloError);
  });
});

describe('forward pass', () => {
  it('cadeia simples A(2) -> B(3)', () => {
    const c = calcularCronograma({
      inicio: INICIO,
      atividades: [
        { id: 'A', duracao_du: 2 },
        { id: 'B', duracao_du: 3, predecessoras: ['A'] },
      ],
    });
    expect(c.porId.A.es).toBe(0);
    expect(c.porId.A.ef).toBe(2);
    expect(c.porId.B.es).toBe(2);
    expect(c.porId.B.ef).toBe(5);
    expect(c.total).toBe(5);
    expect(c.porId.A.inicio_previsto).toBe('2026-01-05');
    expect(c.porId.A.fim_previsto).toBe('2026-01-06');
    expect(c.porId.B.fim_previsto).toBe('2026-01-09');
    expect(c.entrega).toBe('2026-01-09');
  });

  it('dependência múltipla usa o maior EF', () => {
    const c = calcularCronograma({
      inicio: INICIO,
      atividades: [
        { id: 'A', duracao_du: 2 },
        { id: 'B', duracao_du: 3 },
        { id: 'C', duracao_du: 1, predecessoras: ['A', 'B'] },
      ],
    });
    expect(c.porId.C.es).toBe(3); // max(EF A=2, EF B=3)
    expect(c.total).toBe(4);
  });

  it('inicio_manual empurra a atividade e as sucessoras', () => {
    const c = calcularCronograma({
      inicio: INICIO,
      atividades: [
        { id: 'A', duracao_du: 2 },
        { id: 'B', duracao_du: 3, predecessoras: ['A'], inicio_manual: '2026-01-12' }, // +5 du
        { id: 'C', duracao_du: 1, predecessoras: ['B'] },
      ],
    });
    expect(c.porId.B.es).toBe(5); // max(EF A=2, offset 5)
    expect(c.porId.C.es).toBe(8); // empurrada pela B
    expect(c.total).toBe(9);
  });
});

describe('backward pass (folga e caminho crítico)', () => {
  it('ramo mais curto ganha folga; crítico tem folga 0', () => {
    const c = calcularCronograma({
      inicio: INICIO,
      atividades: [
        { id: 'A', duracao_du: 2 },
        { id: 'B', duracao_du: 3 },
        { id: 'C', duracao_du: 1, predecessoras: ['A', 'B'] },
      ],
    });
    expect(c.porId.B.folga).toBe(0);
    expect(c.porId.B.critico).toBe(true);
    expect(c.porId.C.critico).toBe(true);
    expect(c.porId.A.folga).toBe(1); // ramo curto
    expect(c.porId.A.critico).toBe(false);
  });
});

describe('peso', () => {
  it('peso = duração (Q2 isolado)', () => {
    expect(peso(8)).toBe(8);
  });
});
