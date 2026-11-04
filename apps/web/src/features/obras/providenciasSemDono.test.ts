import { describe, expect, it } from 'vitest';
import { providenciarAte } from '@contro/core';
import {
  prazosParaGravar,
  providenciasSemDono,
  type LinhaProvidencia,
} from './providenciasSemDono';

const inicio = '2026-11-02'; // segunda
const cron = { porId: { a1: { es: 10 }, a2: { es: 4 } } };
const atividades = [
  { id: 'a1', nome: 'Elétrica', concluida_em: null },
  { id: 'a2', nome: 'Pintura', concluida_em: '2026-11-03T12:00:00Z' },
];
const prov = (o: Partial<LinhaProvidencia> = {}): LinhaProvidencia => ({
  id: 'p1',
  obra_id: 'o1',
  atividade_id: 'a1',
  tipo: 'compra',
  descricao: 'Cabos',
  status: 'pendente',
  antecedencia_du: 3,
  providenciar_ate: null,
  ...o,
});

describe('providenciasSemDono', () => {
  it('inclui a pendente sem tarefa, com o prazo calculado e os nomes', () => {
    const r = providenciasSemDono([prov()], [], atividades, cron, inicio, 'Savassi');
    expect(r).toEqual([
      {
        id: 'p1',
        obraId: 'o1',
        obraNome: 'Savassi',
        tipo: 'compra',
        descricao: 'Cabos',
        prazo: providenciarAte(inicio, 10, 3),
        atividadeNome: 'Elétrica',
      },
    ]);
    expect(r[0].prazo).toBe('2026-11-11');
  });

  it('exclui a que tem tarefa aberta vinculada', () => {
    const r = providenciasSemDono(
      [prov(), prov({ id: 'p2' })],
      [
        { vinculo_tipo: 'providencia', vinculo_id: 'p1' },
        { vinculo_tipo: 'pendencia', vinculo_id: 'p2' },
      ],
      atividades,
      cron,
      inicio,
      'Savassi',
    );
    expect(r.map((p) => p.id)).toEqual(['p2']);
  });

  it('exclui atividade concluída, status feito e atividade fora do cronograma', () => {
    const r = providenciasSemDono(
      [
        prov({ id: 'concl', atividade_id: 'a2' }),
        prov({ id: 'feito', status: 'feito' }),
        prov({ id: 'sumiu', atividade_id: 'a9' }),
      ],
      [],
      atividades,
      cron,
      inicio,
      'Savassi',
    );
    expect(r).toEqual([]);
  });
});

describe('prazosParaGravar', () => {
  it('só as pendentes cujo prazo mudou, com ou sem tarefa', () => {
    const ate = providenciarAte(inicio, 10, 3);
    const r = prazosParaGravar(
      [
        prov({ id: 'igual', providenciar_ate: ate }),
        prov({ id: 'nulo' }),
        prov({ id: 'velho', providenciar_ate: '2026-11-05' }),
        prov({ id: 'feito', status: 'feito' }),
        prov({ id: 'sumiu', atividade_id: 'a9' }),
      ],
      cron,
      inicio,
    );
    expect(r).toEqual([
      { id: 'nulo', ate },
      { id: 'velho', ate },
    ]);
  });
});
