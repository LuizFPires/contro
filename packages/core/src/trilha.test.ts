import { describe, it, expect } from 'vitest';
import type { AtividadeEstado } from './obra';
import { diaMes, trilhaDeFases, type EntradaTrilha, type TrilhaAtividadeEntrada } from './trilha';

function est(id: string, p: Partial<AtividadeEstado> = {}): AtividadeEstado {
  return {
    id,
    concluida: false,
    predsOk: true,
    provOk: true,
    liberada: false,
    aguardandoProvidencia: false,
    atrasada: false,
    ...p,
  };
}

function atv(id: string, fase_id: string, p: Partial<TrilhaAtividadeEntrada> = {}) {
  return {
    id,
    fase_id,
    nome: id,
    predecessoras: [],
    prestador: null,
    providenciasPendentes: [],
    ...p,
  };
}

const fases = [
  { id: 'f1', ordem: 1, titulo: 'Mobilização' },
  { id: 'f2', ordem: 2, titulo: 'Fechamentos' },
  { id: 'f3', ordem: 3, titulo: 'Acabamentos' },
];

const datas = {
  A: { inicio: '2026-10-05', fim: '2026-10-09' },
  B: { inicio: '2026-10-12', fim: '2026-10-16' },
  Forro: { inicio: '2026-10-20', fim: '2026-10-29' },
  Pintura: { inicio: '2026-11-02', fim: '2026-11-06' },
};

function entrada(estados: Record<string, AtividadeEstado>, extra: Partial<EntradaTrilha> = {}) {
  return {
    fases,
    atividades: [
      atv('A', 'f1'),
      atv('B', 'f2', { predecessoras: ['A'] }),
      atv('Forro', 'f2', { predecessoras: ['A'], prestador: 'Gesso Forte' }),
      atv('Pintura', 'f3', { predecessoras: ['Forro'] }),
    ],
    estados,
    datas,
    ...extra,
  };
}

describe('diaMes', () => {
  it('formata dd/mm', () => {
    expect(diaMes('2026-10-20')).toBe('20/10');
  });
});

describe('trilhaDeFases', () => {
  const base = {
    A: est('A', { concluida: true }),
    B: est('B', { concluida: true }),
    Forro: est('Forro', { liberada: true }),
    Pintura: est('Pintura', { predsOk: false }),
  };

  it('fase concluída, fase em execução e fase planejada', () => {
    const [f1, f2, f3] = trilhaDeFases(entrada(base));
    expect(f1).toMatchObject({ status: 'concluida', rotulo: 'concluída', concluidas: 1, total: 1 });
    expect(f1.info).toBe('Concluída com fotos de todas as etapas');
    expect(f2).toMatchObject({ status: 'execucao', rotulo: 'em execução', concluidas: 1, total: 2 });
    expect(f2.info).toBe('1 atividade liberada para executar');
    expect(f3).toMatchObject({ status: 'planejada', rotulo: 'planejada' });
    expect(f3.info).toBe('Libera quando concluir: Forro');
  });

  it('textos da atividade: concluída, liberada com datas e prestador, planejada', () => {
    const [, f2, f3] = trilhaDeFases(entrada(base));
    const [b, forro] = f2.atividades;
    expect(b).toMatchObject({ status: 'concluida', sub: 'Concluída · foto arquivada', prestador: null });
    expect(forro).toMatchObject({
      status: 'liberada',
      sub: 'Liberada · 20/10–29/10',
      prestador: 'Gesso Forte',
      podeConcluir: true,
    });
    expect(f3.atividades[0]).toMatchObject({
      status: 'planejada',
      sub: 'Planejada · aguarda Forro',
      podeConcluir: false,
    });
  });

  it('aguardando providência mostra o tipo e a descrição', () => {
    const e = entrada(
      { ...base, Forro: est('Forro', { provOk: false, aguardandoProvidencia: true }) },
      {
        atividades: [
          atv('A', 'f1'),
          atv('B', 'f2'),
          atv('Forro', 'f2', {
            providenciasPendentes: [{ tipo: 'contratacao', descricao: 'gesseiro' }],
          }),
          atv('Pintura', 'f3', { predecessoras: ['Forro'] }),
        ],
      },
    );
    const f2 = trilhaDeFases(e)[1];
    expect(f2.atividades[1].sub).toBe('Aguardando contratação: gesseiro');
    expect(f2.atividades[1].podeConcluir).toBe(false);
    expect(f2.info).toBe('1 aguardando contratação, locação ou compra');
  });

  it('atrasada: texto em destaque, contador na fase e câmera se liberada', () => {
    const e = entrada({ ...base, Forro: est('Forro', { liberada: true, atrasada: true }) });
    const f2 = trilhaDeFases(e)[1];
    expect(f2.atividades[1]).toMatchObject({
      status: 'atrasada',
      sub: 'ATRASADA · devia terminar 29/10 · 20/10–29/10',
      podeConcluir: true,
    });
    expect(f2.atrasadas).toBe(1);
    expect(f2.atrasoTxt).toBe('1 atrasada');
  });

  it('plural das atividades liberadas', () => {
    const e = entrada({ ...base, B: est('B', { liberada: true }) });
    expect(trilhaDeFases(e)[1].info).toBe('2 atividades liberadas para executar');
  });

  it('obra toda concluída: nenhuma fase em execução', () => {
    const tudo = Object.fromEntries(
      ['A', 'B', 'Forro', 'Pintura'].map((id) => [id, est(id, { concluida: true })]),
    );
    expect(trilhaDeFases(entrada(tudo)).every((f) => f.status === 'concluida')).toBe(true);
  });
});
