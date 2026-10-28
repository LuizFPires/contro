import { describe, expect, it } from 'vitest';
import {
  classificarPendencias,
  pendenteHa,
  podeVistoriar,
  proximaPendencia,
  topoFila,
  type Pendencia,
} from './pendencias';

const base = (p: Partial<Pendencia>): Pendencia => ({
  id: p.id ?? 'x',
  status: p.status ?? 'aberta',
  ordem_fila: p.ordem_fila ?? 0,
  resolvida_por: p.resolvida_por ?? null,
});

describe('classificarPendencias', () => {
  it('separa em pendentes, em vistoria e vistoriadas (sem adiadas)', () => {
    const ps = [
      base({ id: 'a', status: 'aberta', ordem_fila: 2 }),
      base({ id: 'b', status: 'aberta', ordem_fila: -1 }),
      base({ id: 'd', status: 'em_vistoria' }),
      base({ id: 'e', status: 'fechada' }),
    ];
    const r = classificarPendencias(ps);
    expect(r.pendentes.map((p) => p.id)).toEqual(['b', 'a']);
    expect(r.emVistoria.map((p) => p.id)).toEqual(['d']);
    expect(r.vistoriadas.map((p) => p.id)).toEqual(['e']);
  });

  it('pendentes: altas no topo, médias no meio, baixas no fim; empate por ordem_fila', () => {
    const ps = [
      { ...base({ id: 'b1', ordem_fila: -5 }), criticidade: 'baixa' as const },
      { ...base({ id: 'm1', ordem_fila: 3 }), criticidade: 'media' as const },
      { ...base({ id: 'a1', ordem_fila: 9 }), criticidade: 'alta' as const },
      { ...base({ id: 'a2', ordem_fila: -1 }), criticidade: 'alta' as const },
      base({ id: 'semCrit', ordem_fila: 0 }), // ausente = média
    ];
    expect(classificarPendencias(ps).pendentes.map((p) => p.id)).toEqual([
      'a2',
      'a1',
      'semCrit',
      'm1',
      'b1',
    ]);
  });
});

describe('proximaPendencia', () => {
  it('passa para a seguinte e da última volta à primeira', () => {
    expect(proximaPendencia(0, 3)).toBe(1);
    expect(proximaPendencia(2, 3)).toBe(0);
    expect(proximaPendencia(0, 0)).toBe(0);
  });
});

describe('podeVistoriar (regra 5)', () => {
  it('bloqueia quem resolveu', () => {
    expect(podeVistoriar({ status: 'em_vistoria', resolvida_por: 'p1' }, 'p1')).toBe(false);
  });
  it('permite outra pessoa', () => {
    expect(podeVistoriar({ status: 'em_vistoria', resolvida_por: 'p1' }, 'p2')).toBe(true);
  });
  it('só em vistoria', () => {
    expect(podeVistoriar({ status: 'aberta', resolvida_por: null }, 'p2')).toBe(false);
  });
  it('sem pessoa identificada, bloqueia', () => {
    expect(podeVistoriar({ status: 'em_vistoria', resolvida_por: 'p1' }, null)).toBe(false);
  });
  it('resolvedor desconhecido (null, patch otimista offline) não libera vistoria', () => {
    expect(podeVistoriar({ status: 'em_vistoria', resolvida_por: null }, 'p1')).toBe(false);
  });
});

describe('topoFila', () => {
  it('sem itens, topo é -1 (coalesce 0)', () => {
    expect(topoFila([])).toBe(-1);
  });
  it('com todos positivos, topo é min-1 (bate com o servidor)', () => {
    expect(topoFila([1, 2, 3])).toBe(0);
  });
  it('com negativos, segue abaixo do menor', () => {
    expect(topoFila([-2, 0, 5])).toBe(-3);
  });
});

describe('pendenteHa', () => {
  it('conta dias corridos desde o apontamento (aceita data com hora)', () => {
    expect(pendenteHa('2026-10-26T09:14:00Z', '2026-10-26')).toBe('hoje');
    expect(pendenteHa('2026-10-25', '2026-10-26')).toBe('1 dia');
    expect(pendenteHa('2026-10-22T15:30:00-03:00', '2026-10-26')).toBe('4 dias');
  });
});
