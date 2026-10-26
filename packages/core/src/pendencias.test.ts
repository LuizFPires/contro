import { describe, expect, it } from 'vitest';
import {
  classificarPendencias,
  estaNaFila,
  opcoesAdiamento,
  pendenteHa,
  podeVistoriar,
  topoFila,
  type Pendencia,
} from './pendencias';

const base = (p: Partial<Pendencia>): Pendencia => ({
  id: p.id ?? 'x',
  status: p.status ?? 'aberta',
  ordem_fila: p.ordem_fila ?? 0,
  adiada_ate: p.adiada_ate ?? null,
  resolvida_por: p.resolvida_por ?? null,
});

describe('estaNaFila', () => {
  it('aberta sem adiamento está na fila', () => {
    expect(estaNaFila({ status: 'aberta', adiada_ate: null }, '2026-10-24')).toBe(true);
  });
  it('adiada para o futuro sai da fila', () => {
    expect(estaNaFila({ status: 'aberta', adiada_ate: '2026-10-27' }, '2026-10-24')).toBe(false);
  });
  it('adiada vencida (<= hoje) volta à fila', () => {
    expect(estaNaFila({ status: 'aberta', adiada_ate: '2026-10-24' }, '2026-10-24')).toBe(true);
  });
  it('em vistoria não está na fila', () => {
    expect(estaNaFila({ status: 'em_vistoria', adiada_ate: null }, '2026-10-24')).toBe(false);
  });
});

describe('classificarPendencias', () => {
  it('separa nas quatro listas e ordena a fila por ordem_fila', () => {
    const ps = [
      base({ id: 'a', status: 'aberta', ordem_fila: 2 }),
      base({ id: 'b', status: 'aberta', ordem_fila: -1 }),
      base({ id: 'c', status: 'aberta', adiada_ate: '2026-10-30' }),
      base({ id: 'd', status: 'em_vistoria' }),
      base({ id: 'e', status: 'fechada' }),
      base({ id: 'f', status: 'aberta', adiada_ate: '2026-10-24' }), // vencida → fila
    ];
    const r = classificarPendencias(ps, '2026-10-24');
    expect(r.fila.map((p) => p.id)).toEqual(['b', 'f', 'a']);
    expect(r.adiadas.map((p) => p.id)).toEqual(['c']);
    expect(r.emVistoria.map((p) => p.id)).toEqual(['d']);
    expect(r.concluidas.map((p) => p.id)).toEqual(['e']);
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

describe('opcoesAdiamento', () => {
  it('sábado: seg, ter, qua e a segunda seguinte (dias úteis)', () => {
    expect(opcoesAdiamento('2026-10-24')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-11-02',
    ]);
  });
  it('quinta: sex, seg, ter e a sexta seguinte', () => {
    expect(opcoesAdiamento('2026-10-22')).toEqual([
      '2026-10-23',
      '2026-10-26',
      '2026-10-27',
      '2026-10-30',
    ]);
  });
});

describe('pendenteHa', () => {
  it('conta dias corridos desde o apontamento (aceita data com hora)', () => {
    expect(pendenteHa('2026-10-26T09:14:00Z', '2026-10-26')).toBe('hoje');
    expect(pendenteHa('2026-10-25', '2026-10-26')).toBe('1 dia');
    expect(pendenteHa('2026-10-22T15:30:00-03:00', '2026-10-26')).toBe('4 dias');
  });
});
