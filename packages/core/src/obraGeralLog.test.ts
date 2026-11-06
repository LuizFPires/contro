import { describe, expect, it } from 'vitest';
import { montarLog, vidaDoItem, type EventoBruto, type ItemLog } from './log';
import type { AtividadeGeral } from './obraGeral';
import { itensEquipeObraGeral, itensLogObraGeral } from './obraGeralLog';
import { calcularScoreEquipe, replanejamentosPorEventos, type ItemEquipe } from './score';

// Hoje é sexta, 06/11/2026.
const HOJE = '2026-11-06';
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const fmt = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return `${SEMANA[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]} ${d.slice(8, 10)}/${d.slice(5, 7)}`;
};

const NOMES = { ana: 'Ana Paula Souza', bia: 'Beatriz Lima', caio: 'Caio Mendes' };

function ativ(p: Partial<AtividadeGeral> & { id: string }): AtividadeGeral {
  return {
    fase_id: 'f1',
    pai_id: null,
    ordem: 1,
    nome: `Atividade ${p.id}`,
    data_prevista: '2026-10-28',
    data_prevista_original: null,
    replanejamentos: 0,
    responsavel_id: 'ana',
    concluida_em: null,
    avanco_pct: 0,
    foto_conclusao_id: null,
    prestador: null,
    ...p,
  };
}

let seq = 0;
function ev(p: Partial<EventoBruto> & { itemId: string; tipo: string; em: string }): EventoBruto {
  seq += 1;
  return { id: `e${seq}`, por: null, porNome: null, antes: null, depois: null, ...p };
}

const base = { obraId: 'g1', obraNome: 'Galpão SMS', nomes: NOMES };

describe('replanejamentosPorEventos', () => {
  it('conta as replanejadas por item, menos as desfeitas', () => {
    const eventos = [
      ev({ id: 'r1', itemId: 'a1', tipo: 'replanejada', em: '2026-10-20T10:00:00' }),
      ev({ id: 'r2', itemId: 'a1', tipo: 'replanejada', em: '2026-10-21T10:00:00' }),
      ev({
        itemId: 'a1',
        tipo: 'data_desfeita',
        em: '2026-10-21T10:02:00',
        depois: { data: '2026-10-25', evento_id: 'r2' },
      }),
      ev({ id: 'r3', itemId: 'a2', tipo: 'replanejada', em: '2026-10-22T10:00:00' }),
      ev({ id: 'd1', itemId: 'a2', tipo: 'data_definida', em: '2026-10-19T10:00:00' }),
    ];
    expect(replanejamentosPorEventos(eventos)).toEqual({ a1: 1, a2: 1 });
  });

  it('sem eventos, nada', () => {
    expect(replanejamentosPorEventos([])).toEqual({});
  });
});

describe('itensEquipeObraGeral', () => {
  it('atividade de topo com responsável e data entra com origem atividade', () => {
    const itens = itensEquipeObraGeral({
      ...base,
      atividades: [
        ativ({
          id: 'a1',
          data_prevista: '2026-10-30',
          data_prevista_original: '2026-10-28',
          replanejamentos: 7,
          concluida_em: '2026-10-29T15:00:00',
        }),
        ativ({ id: 'a2', responsavel_id: null }),
        ativ({ id: 'a3', data_prevista: null }),
      ],
      eventos: [ev({ id: 'r1', itemId: 'a1', tipo: 'replanejada', em: '2026-10-27T10:00:00' })],
    });
    expect(itens).toEqual([
      {
        id: 'a1',
        origem: 'atividade',
        obraId: 'g1',
        obraNome: 'Galpão SMS',
        texto: 'Atividade a1',
        chavePessoa: 'ana',
        nomePessoa: 'Ana Paula Souza',
        prazo: '2026-10-30',
        prazoOriginal: '2026-10-28',
        concluidaEm: '2026-10-29T15:00:00',
        // Pelos eventos, não pela coluna.
        replanejamentos: 1,
        excluida: false,
      },
    ]);
  });

  it('subitens: prazo da maior data, original pelos subitens e replanejamento deles conta', () => {
    const [item] = itensEquipeObraGeral({
      ...base,
      atividades: [
        ativ({ id: 'a1', data_prevista: null }),
        ativ({ id: 's1', pai_id: 'a1', data_prevista: '2026-10-29', responsavel_id: null }),
        ativ({
          id: 's2',
          pai_id: 'a1',
          ordem: 2,
          data_prevista: '2026-11-03',
          data_prevista_original: '2026-10-30',
          responsavel_id: null,
        }),
      ],
      eventos: [
        ev({ id: 'r1', itemId: 's2', tipo: 'replanejada', em: '2026-10-27T10:00:00' }),
        ev({ id: 'r9', itemId: 'fora', tipo: 'replanejada', em: '2026-10-27T10:00:00' }),
      ],
    });
    expect(item).toMatchObject({
      id: 'a1',
      prazo: '2026-11-03',
      prazoOriginal: '2026-10-30',
      replanejamentos: 1,
    });
  });

  it('entra no Score da pessoa junto das tarefas; desfeita não conta', () => {
    const atividades = [1, 2, 3, 4, 5].map((n) =>
      ativ({
        id: `a${n}`,
        data_prevista: '2026-10-28',
        data_prevista_original: '2026-10-26',
        concluida_em: '2026-10-28T15:00:00',
      }),
    );
    const eventos = [
      ev({ id: 'r1', itemId: 'a1', tipo: 'replanejada', em: '2026-10-22T10:00:00' }),
      ev({ id: 'r2', itemId: 'a1', tipo: 'replanejada', em: '2026-10-23T10:00:00' }),
      ev({
        itemId: 'a1',
        tipo: 'data_desfeita',
        em: '2026-10-23T10:01:00',
        depois: { evento_id: 'r2' },
      }),
    ];
    const itens: ItemEquipe[] = itensEquipeObraGeral({ ...base, atividades, eventos });
    const [linha] = calcularScoreEquipe(itens, 30, HOJE);
    expect(linha.chave).toBe('ana');
    expect(linha.itens).toBe(5);
    expect(linha.numeros.replanejamentosMedia).toBeCloseTo(1 / 5);
    expect(linha.indicadores.replanejamentos).toBeCloseTo(1 - 1 / 5 / 2);
    // Concluídas 2 d.u. depois do original: "piores" com o replanejamento.
    expect(linha.piores[0]).toEqual({
      id: 'a1',
      texto: 'Atividade a1',
      obraNome: 'Galpão SMS',
      detalhe: '2 d.u. de atraso · 1 replanejamento',
    });
  });
});

describe('itensLogObraGeral', () => {
  it('atividade de topo com data prevista efetiva, original e responsável', () => {
    const itens = itensLogObraGeral({
      ...base,
      criadaEm: '2026-10-01T09:00:00',
      atividades: [
        ativ({ id: 'a1', data_prevista: '2026-10-30', data_prevista_original: '2026-10-28' }),
        ativ({ id: 's1', pai_id: 'a1', data_prevista: '2026-11-02' }),
        ativ({ id: 'a2', responsavel_id: null, data_prevista: null }),
      ],
    });
    expect(itens).toEqual<ItemLog[]>([
      {
        origem: 'atividade',
        id: 'a1',
        obraId: 'g1',
        obraNome: 'Galpão SMS',
        texto: 'Atividade a1',
        prazo: '2026-11-02',
        prazoOriginal: '2026-10-28',
        aberta: true,
        concluidaEm: null,
        responsavelNome: 'Ana Paula Souza',
        responsavelId: 'ana',
        criadaEm: '2026-10-01T09:00:00',
        excluida: false,
        semCronograma: true,
      },
      {
        origem: 'atividade',
        id: 'a2',
        obraId: 'g1',
        obraNome: 'Galpão SMS',
        texto: 'Atividade a2',
        prazo: null,
        prazoOriginal: null,
        aberta: true,
        concluidaEm: null,
        responsavelNome: null,
        responsavelId: null,
        criadaEm: '2026-10-01T09:00:00',
        excluida: false,
        semCronograma: true,
      },
    ]);
  });
});

describe('Log das obras gerais', () => {
  const [item] = itensLogObraGeral({
    ...base,
    atividades: [
      ativ({
        id: 'a1',
        data_prevista: '2026-10-30',
        data_prevista_original: '2026-10-28',
        concluida_em: '2026-11-03T16:00:00',
      }),
    ],
  });
  const eventos: EventoBruto[] = [
    ev({
      id: 'c',
      itemId: 'a1',
      tipo: 'criada',
      em: '2026-10-20T09:00:00',
      por: 'caio',
      porNome: 'Caio Mendes',
      depois: { nome: 'Atividade a1', data_prevista: '2026-10-28' },
    }),
    ev({
      id: 'r1',
      itemId: 'a1',
      tipo: 'replanejada',
      em: '2026-10-22T10:00:00',
      por: 'caio',
      porNome: 'Caio Mendes',
      antes: { data: '2026-10-28', data_prevista_original: null, replanejamentos: 0 },
      depois: { data: '2026-10-29', motivo: 'chuva' },
    }),
    ev({
      id: 'r2',
      itemId: 'a1',
      tipo: 'replanejada',
      em: '2026-10-23T10:00:00',
      por: 'caio',
      porNome: 'Caio Mendes',
      antes: { data: '2026-10-29', data_prevista_original: '2026-10-28', replanejamentos: 1 },
      depois: { data: '2026-11-05' },
    }),
    ev({
      id: 'dd',
      itemId: 'a1',
      tipo: 'data_desfeita',
      em: '2026-10-23T10:03:00',
      por: 'caio',
      porNome: 'Caio Mendes',
      antes: { data: '2026-11-05', data_prevista_original: '2026-10-28', replanejamentos: 2 },
      depois: {
        data: '2026-10-29',
        data_prevista_original: '2026-10-28',
        replanejamentos: 1,
        evento_id: 'r2',
      },
    }),
    ev({
      id: 'r3',
      itemId: 'a1',
      tipo: 'replanejada',
      em: '2026-10-26T10:00:00',
      por: 'caio',
      porNome: 'Caio Mendes',
      antes: { data: '2026-10-29', data_prevista_original: '2026-10-28', replanejamentos: 1 },
      depois: { data: '2026-10-30' },
    }),
    ev({
      id: 'resp',
      itemId: 'a1',
      tipo: 'responsavel',
      em: '2026-10-27T11:00:00',
      por: 'caio',
      porNome: 'Caio Mendes',
      antes: { responsavel_id: 'bia' },
      depois: { responsavel_id: 'ana' },
    }),
    ev({
      id: 'fim',
      itemId: 'a1',
      tipo: 'concluida',
      em: '2026-11-03T16:00:00',
      por: 'bia',
      porNome: 'Beatriz Lima',
      depois: { foto_id: null, responsavel_id: 'ana' },
    }),
  ];

  const linhas = montarLog({
    itens: [item],
    eventos: eventos.map((evento) => ({ origem: 'atividade' as const, evento })),
    hoje: HOJE,
    formatarData: fmt,
    nomes: NOMES,
  });
  const semVencida = (ls: ReturnType<typeof montarLog>) => ls.filter((l) => l.tipo !== 'vencida');
  const resumo = (id: string) => {
    const l = linhas.find((x) => x.id === id);
    return l && [l.tipo, l.pessoa, l.detalhe, l.cor];
  };

  it('criada com a data prevista', () => {
    expect(resumo('c')).toEqual(['criada', 'Caio M', 'prazo qua 28/10', 'neutra']);
  });

  it('replanejada lê a data; a desfeita fica no log sem contar vez', () => {
    expect(resumo('r1')).toEqual([
      'replanejada',
      'Caio M',
      'de qua 28/10 para qui 29/10 · 1ª vez · "chuva"',
      'atencao',
    ]);
    expect(resumo('r2')).toEqual([
      'replanejada',
      'Caio M',
      'de qui 29/10 para qui 05/11 · desfeita',
      'atencao',
    ]);
    expect(resumo('r3')).toEqual([
      'replanejada',
      'Caio M',
      'de qui 29/10 para sex 30/10 · 2ª vez',
      'atencao',
    ]);
  });

  it('desfez a mudança de data: volta para a data anterior', () => {
    expect(resumo('dd')).toEqual(['data_desfeita', 'Caio M', 'voltou para qui 29/10', 'neutra']);
  });

  it('trocou o responsável, com os nomes de fora', () => {
    expect(resumo('resp')).toEqual([
      'responsavel_trocado',
      'Caio M',
      'de Beatriz L para Ana P',
      'neutra',
    ]);
  });

  it('concluiu por outra pessoa: diz de quem era, contra a data prevista', () => {
    expect(resumo('fim')).toEqual([
      'concluida',
      'Beatriz L',
      '2 d.u. depois da data prevista · responsável: Ana P',
      'ok',
    ]);
  });

  it('concluiu pelo próprio responsável: sem "responsável:"', () => {
    const [l] = semVencida(
      montarLog({
        itens: [item],
        eventos: [
          {
            origem: 'atividade',
            evento: ev({
              itemId: 'a1',
              tipo: 'concluida',
              em: '2026-10-30T16:00:00',
              por: 'ana',
              porNome: 'Ana Paula Souza',
              depois: { foto_id: 'f1', responsavel_id: 'ana' },
            }),
          },
        ],
        hoje: HOJE,
        formatarData: fmt,
        nomes: NOMES,
      }),
    );
    expect(l.detalhe).toBe('no prazo · com foto');
  });

  it('data definida: "para" e "de … para"', () => {
    const ls = semVencida(
      montarLog({
        itens: [item],
        eventos: [
          ev({
            itemId: 'a1',
            tipo: 'data_definida',
            em: '2026-10-20T09:00:00',
            antes: { data: null, data_prevista_original: null, replanejamentos: 0 },
            depois: { data: '2026-10-28' },
          }),
          ev({
            itemId: 'a1',
            tipo: 'data_definida',
            em: '2026-11-04T09:00:00',
            antes: { data: '2026-10-30', data_prevista_original: '2026-10-28', replanejamentos: 1 },
            depois: { data: '2026-11-02' },
          }),
        ].map((evento) => ({ origem: 'atividade' as const, evento })),
        hoje: HOJE,
        formatarData: fmt,
      }),
    );
    expect(ls.map((l) => [l.tipo, l.detalhe, l.cor])).toEqual([
      ['data_alterada', 'de sex 30/10 para seg 02/11', 'neutra'],
      ['data_alterada', 'para qua 28/10', 'neutra'],
    ]);
  });

  it('responsável retirado ou sem nome conhecido', () => {
    const ls = semVencida(
      montarLog({
        itens: [item],
        eventos: [
          ev({
            itemId: 'a1',
            tipo: 'responsavel',
            em: '2026-10-20T09:00:00',
            antes: { responsavel_id: 'ana' },
            depois: { responsavel_id: null },
          }),
          ev({
            itemId: 'a1',
            tipo: 'responsavel',
            em: '2026-10-21T09:00:00',
            antes: { responsavel_id: null },
            depois: { responsavel_id: 'xx' },
          }),
        ].map((evento) => ({ origem: 'atividade' as const, evento })),
        hoje: HOJE,
        formatarData: fmt,
        nomes: NOMES,
      }),
    );
    expect(ls.map((l) => l.detalhe)).toEqual(['responsável alterado', 'sem responsável']);
  });

  it('vida do item: a desfeita não conta no resumo', () => {
    const vida = vidaDoItem(item, eventos, HOJE, fmt, NOMES);
    expect(vida.passos.map((p) => p.rotulo)).toEqual([
      'Criada',
      'Replanejada 1x',
      'Replanejada',
      'Mudança de data desfeita',
      'Replanejada 2x',
      'Responsável trocado',
      'Venceu',
      'Concluída',
    ]);
    expect(vida.resumo).toBe('4 d.u. além do prazo original · 2 replanejamentos · 14 dias aberta');
  });

  it('vencida: atividade aberta com a data prevista passada, do responsável', () => {
    const [aberta] = itensLogObraGeral({
      ...base,
      atividades: [ativ({ id: 'a9', data_prevista: '2026-11-03' })],
    });
    const [l] = montarLog({ itens: [aberta], eventos: [], hoje: HOJE, formatarData: fmt });
    expect([l.tipo, l.dia, l.pessoa, l.pessoaId, l.detalhe]).toEqual([
      'vencida',
      '2026-11-04',
      'Ana P',
      'ana',
      'prazo era ter 03/11',
    ]);
  });
});
