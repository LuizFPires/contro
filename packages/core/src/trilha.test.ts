import { describe, it, expect } from 'vitest';
import type { AtividadeEstado } from './obra';
import { calcularCronograma } from './schedule';
import {
  diaMes,
  faixasDeFases,
  trilhaDeFases,
  type EntradaTrilha,
  type TrilhaAtividadeEntrada,
} from './trilha';

function est(id: string, p: Partial<AtividadeEstado> = {}): AtividadeEstado {
  return {
    id,
    concluida: false,
    liberada: !p.concluida,
    lembretesPendentes: false,
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
    Forro: est('Forro'),
    Pintura: est('Pintura'),
  };

  it('fase concluída, fase em execução e fase planejada', () => {
    const [f1, f2, f3] = trilhaDeFases(entrada(base));
    expect(f1).toMatchObject({ status: 'concluida', rotulo: 'concluída', concluidas: 1, total: 1 });
    expect(f1.info).toBe('Concluída com fotos de todas as etapas');
    expect(f2).toMatchObject({
      status: 'execucao',
      rotulo: 'em execução',
      concluidas: 1,
      total: 2,
    });
    expect(f2.info).toBe('1 atividade a executar');
    expect(f3).toMatchObject({ status: 'planejada', rotulo: 'planejada' });
    expect(f3.info).toBe('1 atividade a executar');
  });

  it('textos da atividade: concluída e aberta (mesmo com a anterior aberta)', () => {
    const [, f2, f3] = trilhaDeFases(entrada(base));
    const [b, forro] = f2.atividades;
    expect(b).toMatchObject({
      status: 'concluida',
      sub: 'Concluída · foto arquivada',
      prestador: null,
    });
    expect(forro).toMatchObject({
      status: 'liberada',
      sub: 'Prevista 20/10–29/10',
      prestador: 'Gesso Forte',
      podeConcluir: true,
    });
    // Sem atividade bloqueada: Pintura depende do Forro (aberto) e pode ser concluída.
    expect(f3.atividades[0]).toMatchObject({
      status: 'liberada',
      sub: 'Prevista 02/11–06/11',
      podeConcluir: true,
    });
  });

  it('lembrete pendente só avisa: mostra o tipo e a descrição e não trava', () => {
    const e = entrada(
      { ...base, Forro: est('Forro', { lembretesPendentes: true }) },
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
    expect(f2.atividades[1].sub).toBe('Prevista 20/10–29/10 · falta contratação: gesseiro');
    expect(f2.atividades[1].podeConcluir).toBe(true);
    expect(f2.info).toBe('1 com contratação, locação ou compra a providenciar');
  });

  it('atrasada: texto em destaque, contador na fase e câmera', () => {
    const e = entrada({ ...base, Forro: est('Forro', { atrasada: true }) });
    const f2 = trilhaDeFases(e)[1];
    expect(f2.atividades[1]).toMatchObject({
      status: 'atrasada',
      sub: 'ATRASADA · devia terminar 29/10',
      podeConcluir: true,
    });
    expect(f2.atrasadas).toBe(1);
    expect(f2.atrasoTxt).toBe('1 atrasada');
  });

  it('plural das atividades a executar', () => {
    const e = entrada({ ...base, B: est('B') });
    expect(trilhaDeFases(e)[1].info).toBe('2 atividades a executar');
  });

  it('obra toda concluída: nenhuma fase em execução', () => {
    const tudo = Object.fromEntries(
      ['A', 'B', 'Forro', 'Pintura'].map((id) => [id, est(id, { concluida: true })]),
    );
    expect(trilhaDeFases(entrada(tudo)).every((f) => f.status === 'concluida')).toBe(true);
  });
});

describe('trilhaDeFases · conclusão sem foto', () => {
  it('marca a atividade e a fase concluídas sem foto', () => {
    const tudo = Object.fromEntries(
      ['A', 'B', 'Forro', 'Pintura'].map((id) => [id, est(id, { concluida: true })]),
    );
    const e = entrada(tudo, {
      atividades: [
        atv('A', 'f1', { temFoto: false }),
        atv('B', 'f2'),
        atv('Forro', 'f2', { temFoto: true }),
        atv('Pintura', 'f3'),
      ],
    });
    const [f1, f2] = trilhaDeFases(e);
    expect(f1.atividades[0]).toMatchObject({ sub: 'Concluída · sem foto', semFoto: true });
    expect(f1.info).toBe('Concluída · 1 atividade sem foto');
    expect(f2.atividades[1]).toMatchObject({ sub: 'Concluída · foto arquivada', semFoto: false });
    expect(f2.info).toBe('Concluída com fotos de todas as etapas');
  });
});

describe('faixasDeFases', () => {
  it('vai do início da 1ª atividade ao fim da última; pula fase vazia e subitens', () => {
    const atividades = [
      { id: 'A', fase_id: 'f1', pai_id: null, duracao_du: 2 },
      { id: 'B', fase_id: 'f2', pai_id: null, duracao_du: 3, predecessoras: ['A'] },
      { id: 'C', fase_id: 'f2', pai_id: null, duracao_du: 5, predecessoras: ['A'] },
    ];
    const cron = calcularCronograma({ inicio: '2026-10-26', atividades });
    const faixas = faixasDeFases(fases, atividades, cron);
    expect(faixas.map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(faixas[0]).toMatchObject({ es: 0, ef: 2, inicio: '2026-10-26', fim: '2026-10-27' });
    expect(faixas[1]).toMatchObject({ es: 2, ef: 7, inicio: '2026-10-28', fim: '2026-11-03' });
  });
});
