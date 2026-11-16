import { describe, expect, it } from 'vitest';
import { avancoFisicoDaObra, projetarAtividade, textoDiasUteis } from './avancoFisico';
import type { EntradaRecuperacao } from './recuperacao';
import type { Medicao, Quantitativo } from './medicao';

// Exemplo do protótipo: piso 1.200 m² em 10 d.u. a partir de seg 09/11/2026,
// medido até sex 13/11 (556 m²); hoje é seg 16/11.
const med = (id: string, de: string, ate: string, quantidade: number): Medicao => ({
  id,
  tipo: de === ate ? 'dia' : 'periodo',
  de,
  ate,
  quantidade,
  pessoas: 4,
});
const MEDS_PISO = [
  med('m1', '2026-11-09', '2026-11-09', 85),
  med('m2', '2026-11-10', '2026-11-10', 104),
  med('m3', '2026-11-11', '2026-11-12', 236),
  med('m4', '2026-11-13', '2026-11-13', 131),
];
const Q_PISO: Quantitativo = {
  total: 1200,
  unidade: 'm²',
  pessoas: null,
  inicio: '2026-11-09',
  fim: '2026-11-20',
  du: 10,
};
const HOJE = '2026-11-16';

/** piso (10) → rodapé (5); forro (3, paralelo, sem sucessora); pintura (4, depois do rodapé). */
function obra(): EntradaRecuperacao {
  return {
    inicio: '2026-11-09',
    hoje: HOJE,
    atividades: [
      { id: 'piso', duracao_du: 10, pai_id: null },
      { id: 'rodape', duracao_du: 5, pai_id: null, predecessoras: ['piso'] },
      { id: 'forro', duracao_du: 3, pai_id: null },
      { id: 'pintura', duracao_du: 4, pai_id: null, predecessoras: ['rodape'] },
    ],
    concluidas: new Set(),
    nomes: {},
    entregaOriginal: null,
  };
}

describe('projetarAtividade', () => {
  it('projeta o término no ritmo medido (o exemplo do protótipo)', () => {
    const p = projetarAtividade(
      { id: 'piso', q: Q_PISO, medicoes: MEDS_PISO, concluida: false },
      HOJE,
    );
    expect(p.estado).toBe('andamento');
    expect(p.real).toBe(556);
    expect(p.ritmo).toBeCloseTo(111.2, 5);
    expect(p.restante).toEqual({ inicio: '2026-11-16', du: 6 });
    expect(p.fimProjetado).toBe('2026-11-23');
    expect(p.atrasoDu).toBe(1);
    expect(p.situacao.tom).toBe('atraso');
    expect(p.curva.pontos.map((x) => x.du)).toEqual([0, 1, 2, 4, 5]);
    expect(p.curva.planoFim).toBe(10);
    expect(p.curva.fim).toBe(11);
  });

  it('sem medição não projeta; concluída também não', () => {
    const sem = projetarAtividade({ id: 'x', q: Q_PISO, medicoes: [], concluida: false }, HOJE);
    expect(sem.estado).toBe('sem_medicao');
    expect(sem.fimProjetado).toBeNull();
    const ok = projetarAtividade(
      {
        id: 'x',
        q: Q_PISO,
        medicoes: [med('a', '2026-11-09', '2026-11-13', 1200)],
        concluida: false,
      },
      HOJE,
    );
    expect(ok.estado).toBe('concluida');
  });

  it('ritmo acima da meta termina antes do prazo', () => {
    const q = { ...Q_PISO, total: 500 };
    const p = projetarAtividade(
      { id: 'x', q, medicoes: [med('a', '2026-11-09', '2026-11-13', 400)], concluida: false },
      HOJE,
    );
    // 80/dia, faltam 100 → 2 d.u. (seg 16 e ter 17).
    expect(p.fimProjetado).toBe('2026-11-17');
    expect(p.adiantaDu).toBe(3);
    expect(p.atrasoDu).toBe(0);
  });

  it('o restante começa depois da última medição quando ela é de hoje', () => {
    const p = projetarAtividade(
      {
        id: 'x',
        q: Q_PISO,
        medicoes: [med('a', '2026-11-09', '2026-11-16', 600)],
        concluida: false,
      },
      HOJE,
    );
    expect(p.restante?.inicio).toBe('2026-11-17');
  });
});

describe('avancoFisicoDaObra', () => {
  it('atividade crítica atrasa a inauguração e diz quanto precisa por dia', () => {
    const r = avancoFisicoDaObra(obra(), [
      { id: 'piso', q: Q_PISO, medicoes: MEDS_PISO, concluida: false },
    ]);
    const piso = r.atividades[0];
    expect(piso.impactoDu).toBe(1);
    expect(piso.precisaPorDia).toBeCloseTo(128.8, 5);
    expect(r.impactoDu).toBe(1);
    expect(r.atrasoNoRitmoDu).toBe(1);
    expect(r.entregaNoRitmo > r.entregaPrevista).toBe(true);
  });

  it('atraso dentro da folga não mexe na inauguração', () => {
    const qForro: Quantitativo = {
      total: 300,
      unidade: 'm²',
      pessoas: null,
      inicio: '2026-11-09',
      fim: '2026-11-11',
      du: 3,
    };
    const r = avancoFisicoDaObra(obra(), [
      {
        id: 'forro',
        q: qForro,
        medicoes: [med('f', '2026-11-09', '2026-11-13', 200)],
        concluida: false,
      },
    ]);
    const forro = r.atividades[0];
    expect(forro.atrasoDu).toBeGreaterThan(0);
    expect(forro.impactoDu).toBe(0);
    expect(forro.precisaPorDia).toBeNull();
    expect(r.impactoDu).toBe(0);
    expect(r.entregaNoRitmo).toBe(r.entregaPrevista);
  });

  it('ordena quem atrasa a inauguração primeiro e as concluídas por último', () => {
    const qForro: Quantitativo = {
      ...Q_PISO,
      total: 90,
      inicio: '2026-11-09',
      fim: '2026-11-11',
      du: 3,
    };
    const r = avancoFisicoDaObra(obra(), [
      {
        id: 'forro',
        q: qForro,
        medicoes: [med('f', '2026-11-09', '2026-11-11', 90)],
        concluida: false,
      },
      {
        id: 'pintura',
        q: { ...Q_PISO, inicio: '2026-11-30', fim: '2026-12-03', du: 4 },
        medicoes: [],
        concluida: false,
      },
      { id: 'piso', q: Q_PISO, medicoes: MEDS_PISO, concluida: false },
    ]);
    expect(r.atividades.map((a) => [a.id, a.estado])).toEqual([
      ['piso', 'andamento'],
      ['pintura', 'sem_medicao'],
      ['forro', 'concluida'],
    ]);
  });
});

describe('textoDiasUteis', () => {
  it('singular e plural', () => {
    expect(textoDiasUteis(1)).toBe('1 dia útil');
    expect(textoDiasUteis(6)).toBe('6 dias úteis');
  });
});
