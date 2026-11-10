import { describe, it, expect } from 'vitest';
import { addDU } from './calendar';
import {
  comecarProvidencia,
  limiteProvidencia,
  naObraEm,
  prazosParaGravar,
  providenciaAtrasada,
  prazoVigenteProvidencia,
  prazosTarefaPorProvidencia,
  providenciarAte,
  providenciasSemDono,
  semTarefaAberta,
  type LinhaProvidencia,
} from './providencias';

const INICIO = '2026-01-05'; // segunda

describe('providências (SPEC 4.4)', () => {
  it('limite = ES − antecedência', () => {
    expect(limiteProvidencia(10, 3)).toBe(7);
    expect(limiteProvidencia(2, 5)).toBe(-3); // pode ficar negativo
  });

  it('providenciar_até usa max(limite, 0)', () => {
    expect(providenciarAte(INICIO, 10, 3)).toBe(addDU(INICIO, 7));
    expect(providenciarAte(INICIO, 2, 5)).toBe(INICIO); // limite negativo -> início
  });

  it('na_obra_em: override tem prioridade; senão início previsto da atividade', () => {
    expect(naObraEm(INICIO, 5, '2026-02-02')).toBe('2026-02-02');
    expect(naObraEm(INICIO, 5)).toBe(addDU(INICIO, 5));
  });

  it('atrasada quando pendente, obra iniciada e o dia limite já passou', () => {
    expect(
      providenciaAtrasada({
        status: 'pendente',
        atividadeConcluida: false,
        obraIniciada: true,
        decorridos: 8,
        esAtividade: 10,
        antecedenciaDu: 3, // limite 7
      }),
    ).toBe(true);
  });

  it('não atrasada: dentro do prazo, feita, concluída ou obra não iniciada', () => {
    const base = {
      status: 'pendente' as const,
      atividadeConcluida: false,
      obraIniciada: true,
      decorridos: 5,
      esAtividade: 10,
      antecedenciaDu: 3,
    };
    expect(providenciaAtrasada(base)).toBe(false); // 5 < limite 7
    expect(providenciaAtrasada({ ...base, decorridos: 7 })).toBe(false); // no dia limite ainda vale
    expect(providenciaAtrasada({ ...base, decorridos: 8, status: 'feito' })).toBe(false);
    expect(providenciaAtrasada({ ...base, decorridos: 8, atividadeConcluida: true })).toBe(false);
    expect(providenciaAtrasada({ ...base, decorridos: 8, obraIniciada: false })).toBe(false);
  });
});

describe('comecarProvidencia', () => {
  it('prazo menos o tempo que leva, em dias úteis', () => {
    // Atividade no dia 20, antecedência 10 → prazo no dia 10; leva 5 → começa no dia 5.
    expect(comecarProvidencia(INICIO, 20, 10, 5)).toBe(addDU(INICIO, 5));
    expect(comecarProvidencia(INICIO, 20, 10, 0)).toBe(addDU(INICIO, 10));
  });
  it('pode começar antes do início da obra', () => {
    expect(comecarProvidencia(INICIO, 2, 2, 3) < INICIO).toBe(true);
  });
});

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

describe('semTarefaAberta', () => {
  const p = (id: string) => ({
    id,
    obraId: 'o1',
    obraNome: 'Savassi',
    tipo: 'compra' as const,
    descricao: 'Cabos',
    prazo: '2026-11-11',
    atividadeNome: 'Elétrica',
  });

  it('tira só a que tem tarefa aberta vinculada à providência no cache', () => {
    const r = semTarefaAberta(
      [p('p1'), p('p2'), p('p3'), p('p4')],
      [
        { status: 'aberta', vinculo_tipo: 'providencia', vinculo_id: 'p1' },
        { status: 'feita', vinculo_tipo: 'providencia', vinculo_id: 'p2' },
        { status: 'aberta', vinculo_tipo: 'pendencia', vinculo_id: 'p3' },
      ],
    );
    expect(r.map((x) => x.id)).toEqual(['p2', 'p3', 'p4']);
  });
});

describe('providência replanejada (tarefa aberta vinculada)', () => {
  const atrasadaPeloCronograma = {
    status: 'pendente' as const,
    atividadeConcluida: false,
    obraIniciada: true,
    decorridos: 20,
    esAtividade: 10,
    antecedenciaDu: 3,
  };

  it('sem tarefa, segue o cronograma', () => {
    expect(providenciaAtrasada(atrasadaPeloCronograma)).toBe(true);
  });

  it('prazo da tarefa no futuro tira do atraso', () => {
    expect(
      providenciaAtrasada({
        ...atrasadaPeloCronograma,
        replanejada: { prazo: '2026-11-30', hoje: '2026-11-10' },
      }),
    ).toBe(false);
  });

  it('vale até o dia do prazo da tarefa e atrasa no dia seguinte', () => {
    const r = (hoje: string) =>
      providenciaAtrasada({
        ...atrasadaPeloCronograma,
        replanejada: { prazo: '2026-11-30', hoje },
      });
    expect(r('2026-11-30')).toBe(false);
    expect(r('2026-12-01')).toBe(true);
  });

  it('feita ou com atividade concluída nunca atrasa', () => {
    const rep = { prazo: '2026-11-01', hoje: '2026-11-10' };
    expect(providenciaAtrasada({ ...atrasadaPeloCronograma, replanejada: rep })).toBe(true);
    expect(
      providenciaAtrasada({ ...atrasadaPeloCronograma, status: 'feito', replanejada: rep }),
    ).toBe(false);
    expect(
      providenciaAtrasada({
        ...atrasadaPeloCronograma,
        atividadeConcluida: true,
        replanejada: rep,
      }),
    ).toBe(false);
  });

  it('prazo vigente: o da tarefa, com o original guardado', () => {
    expect(prazoVigenteProvidencia('2026-10-26', '2026-11-30')).toEqual({
      ate: '2026-11-30',
      original: '2026-10-26',
    });
    expect(prazoVigenteProvidencia('2026-10-26', null)).toEqual({
      ate: '2026-10-26',
      original: null,
    });
    expect(prazoVigenteProvidencia('2026-10-26', '2026-10-26').original).toBeNull();
  });

  it('mapa de prazos: só tarefa aberta vinculada a providência', () => {
    const m = prazosTarefaPorProvidencia([
      { status: 'aberta', vinculo_tipo: 'providencia', vinculo_id: 'p1', prazo: '2026-11-30' },
      { status: 'feita', vinculo_tipo: 'providencia', vinculo_id: 'p2', prazo: '2026-11-30' },
      { status: 'aberta', vinculo_tipo: 'atividade', vinculo_id: 'a1', prazo: '2026-11-30' },
    ]);
    expect([...m.entries()]).toEqual([['p1', '2026-11-30']]);
  });
});
