import { describe, expect, it } from 'vitest';
import {
  agruparPorDia,
  filtrarLog,
  montarLog,
  rotuloLinhaLog,
  vidaDoItem,
  type EventoBruto,
  type ItemLog,
  type LinhaLog,
  type OrigemLog,
} from './log';

const HOJE = '2026-11-04';
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const SEMANA_LONGA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function diaSemana(d: string): number {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
}
/** "2026-11-04" → "qua 04/11". */
const fmt = (d: string) => `${SEMANA[diaSemana(d)]} ${d.slice(8, 10)}/${d.slice(5, 7)}`;
/** "2026-11-04" → "Quarta, 04/11". */
const fmtCompleto = (d: string) =>
  `${SEMANA_LONGA[diaSemana(d)]}, ${d.slice(8, 10)}/${d.slice(5, 7)}`;

function item(p: Partial<ItemLog> & { id: string }): ItemLog {
  return {
    origem: 'tarefa',
    obraId: 'o1',
    obraNome: 'Savassi',
    texto: 'Trocar o rodapé',
    prazo: null,
    prazoOriginal: null,
    aberta: true,
    concluidaEm: null,
    responsavelNome: null,
    excluida: false,
    ...p,
  };
}

let seq = 0;
function ev(p: Partial<EventoBruto> & { itemId: string; tipo: string; em: string }): EventoBruto {
  seq += 1;
  return { id: `e${seq}`, por: null, porNome: null, antes: null, depois: null, ...p };
}

function entrada(itens: ItemLog[], eventos: { origem: OrigemLog; evento: EventoBruto }[]) {
  return { itens, eventos, hoje: HOJE, formatarData: fmt };
}

// Tarefa: criada qui 22/10 com prazo seg 26/10, replanejada duas vezes,
// concluída sex 30/10 (4 d.u. além do prazo original, 8 dias aberta).
const tarefa = item({
  id: 't1',
  prazo: '2026-10-30',
  prazoOriginal: '2026-10-26',
  aberta: false,
  concluidaEm: '2026-10-30T15:00:00',
  responsavelNome: 'Matheus Teófilo',
});
const eventosTarefa: EventoBruto[] = [
  ev({
    itemId: 't1',
    tipo: 'criada',
    em: '2026-10-22T09:00:00',
    por: 'u-ana',
    porNome: 'Ana Paula Souza',
    depois: { prazo: '2026-10-26' },
  }),
  ev({
    itemId: 't1',
    tipo: 'replanejada',
    em: '2026-10-26T10:00:00',
    porNome: 'Matheus Teófilo',
    antes: { prazo: '2026-10-26' },
    depois: { prazo: '2026-10-28' },
  }),
  ev({ itemId: 't1', tipo: 'editada', em: '2026-10-27T10:00:00', porNome: 'Matheus Teófilo' }),
  ev({
    itemId: 't1',
    tipo: 'replanejada',
    em: '2026-10-28T11:00:00',
    porNome: 'Matheus Teófilo',
    antes: { prazo: '2026-10-28' },
    depois: { prazo: '2026-10-30', motivo: 'faltou material' },
  }),
  ev({ itemId: 't1', tipo: 'concluida', em: '2026-10-30T15:00:00', porNome: 'Matheus Teófilo' }),
];

describe('montarLog', () => {
  it('tarefa criada, replanejada 2x e concluída vira 4 linhas com cores e detalhes', () => {
    const linhas = montarLog(
      entrada(
        [tarefa],
        eventosTarefa.map((evento) => ({ origem: 'tarefa', evento })),
      ),
    );
    expect(linhas.map((l) => l.tipo)).toEqual([
      'concluida',
      'replanejada',
      'replanejada',
      'criada',
    ]);
    expect([...linhas].reverse().map((l) => l.cor)).toEqual(['neutra', 'atencao', 'atencao', 'ok']);
    expect(linhas[1].detalhe).toBe('de qua 28/10 para sex 30/10 · 2ª vez · "faltou material"');
    expect(linhas[2].detalhe).toBe('de seg 26/10 para qua 28/10 · 1ª vez');
    expect(linhas[3].detalhe).toBe('prazo seg 26/10');
    expect(linhas[0]).toMatchObject({
      origem: 'tarefa',
      itemId: 't1',
      itemTexto: 'Trocar o rodapé',
      obraId: 'o1',
      obraNome: 'Savassi',
      pessoa: 'Matheus T',
      dia: '2026-10-30',
      detalhe: '4 d.u. depois do prazo',
    });
    expect(linhas[3].pessoa).toBe('Ana P');
    expect(linhas[3].pessoaId).toBe('u-ana');
    expect(linhas[0].pessoaId).toBeNull();
  });

  it('deriva "vencida" no primeiro dia útil após o prazo quando o item seguia aberto', () => {
    const t = item({
      id: 't2',
      prazo: '2026-10-29',
      prazoOriginal: '2026-10-29',
      responsavelNome: 'João Lima',
      responsavelId: 'u-joao',
    });
    const linhas = montarLog(entrada([t], []));
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      id: 'vencida:t2',
      tipo: 'vencida',
      cor: 'atraso',
      em: '2026-10-30T00:00:00',
      dia: '2026-10-30',
      detalhe: 'prazo era qui 29/10',
      pessoa: 'João L',
      pessoaId: 'u-joao',
    });
  });

  it('prazo num sábado vence na segunda seguinte', () => {
    const t = item({ id: 't3', prazo: '2026-10-31' });
    const [l] = montarLog(entrada([t], []));
    expect(l.tipo).toBe('vencida');
    expect(l.dia).toBe('2026-11-02');
  });

  it('prazo num sábado concluído na segunda conta 1 d.u. de atraso (igual ao Score)', () => {
    const t = item({
      id: 't5',
      prazo: '2026-10-31',
      prazoOriginal: '2026-10-31',
      aberta: false,
      concluidaEm: '2026-11-02T10:00:00',
    });
    const evs = [ev({ itemId: 't5', tipo: 'concluida', em: '2026-11-02T10:00:00' })];
    const [l] = montarLog(
      entrada(
        [t],
        evs.map((evento) => ({ origem: 'tarefa' as const, evento })),
      ),
    );
    expect(l.detalhe).toBe('1 d.u. depois do prazo');
    expect(vidaDoItem(t, evs, HOJE, fmt).resumo).toMatch(/^1 d\.u\. além do prazo original/);
  });

  it('não deriva "vencida" se concluiu até o dia útil seguinte ao prazo, nem antes de chegar esse dia', () => {
    const noDia = item({
      id: 'a',
      prazo: '2026-10-29',
      aberta: false,
      concluidaEm: '2026-10-30T18:00:00',
    });
    const depois = item({
      id: 'b',
      prazo: '2026-10-29',
      aberta: false,
      concluidaEm: '2026-11-02T08:00:00',
    });
    const futuro = item({ id: 'c', prazo: HOJE });
    const antigo = item({ id: 'd', prazo: '2026-07-01' });
    const linhas = montarLog(entrada([noDia, depois, futuro, antigo], []));
    expect(linhas.map((l) => l.itemId)).toEqual(['b']);
  });

  it('item excluído não tem "vencida"', () => {
    const t = item({ id: 't4', prazo: '2026-10-29', excluida: true });
    expect(montarLog(entrada([t], []))).toEqual([]);
  });

  it('atividade concluída com atraso e foto; início ajustado; avanço', () => {
    const at = item({
      id: 'a1',
      origem: 'atividade',
      texto: 'Pintura',
      prazo: '2026-10-27',
      aberta: false,
      concluidaEm: '2026-10-29T16:00:00',
    });
    const eventos = [
      ev({
        itemId: 'a1',
        tipo: 'inicio_ajustado',
        em: '2026-10-20T08:00:00',
        antes: { inicio_manual: '2026-10-20' },
        depois: { inicio_manual: '2026-10-21' },
      }),
      ev({
        itemId: 'a1',
        tipo: 'inicio_ajustado',
        em: '2026-10-20T08:30:00',
        antes: { inicio_manual: null },
        depois: { inicio_manual: '2026-10-21' },
      }),
      ev({
        itemId: 'a1',
        tipo: 'avanco',
        em: '2026-10-26T08:00:00',
        antes: { pct: 25 },
        depois: { pct: 50 },
      }),
      ev({ itemId: 'a1', tipo: 'subitem', em: '2026-10-26T09:00:00' }),
      ev({ itemId: 'a1', tipo: 'concluida', em: '2026-10-29T16:00:00', depois: { foto_id: 'f1' } }),
    ].map((evento) => ({ origem: 'atividade' as const, evento }));
    const linhas = montarLog(entrada([at], eventos));
    expect(linhas.map((l) => [l.tipo, l.detalhe, l.cor])).toEqual([
      ['concluida', '2 d.u. depois do fim previsto · com foto', 'ok'],
      ['vencida', 'prazo era ter 27/10', 'atraso'],
      ['avanco', '50% feito', 'neutra'],
      ['inicio_ajustado', 'início ajustado', 'atencao'],
      ['inicio_ajustado', 'de ter 20/10 para qua 21/10', 'atencao'],
    ]);
  });

  it('atividade concluída no prazo, sem foto', () => {
    const at = item({
      id: 'a2',
      origem: 'atividade',
      prazo: '2026-10-27',
      aberta: false,
      concluidaEm: '2026-10-27T10:00:00',
    });
    const [l] = montarLog(
      entrada(
        [at],
        [
          {
            origem: 'atividade',
            evento: ev({ itemId: 'a2', tipo: 'concluida', em: '2026-10-27T10:00:00' }),
          },
        ],
      ),
    );
    expect(l.detalhe).toBe('no prazo');
  });

  it('pendência apontada, atribuída e resolvida; providência atribuída', () => {
    const p = item({
      id: 'p1',
      origem: 'pendencia',
      texto: 'Rejunte',
      prazo: '2026-11-03',
      aberta: false,
      concluidaEm: '2026-11-02T10:00:00',
      responsavelNome: 'João Lima',
    });
    const prov = item({
      id: 't9',
      texto: 'Contratação: Pintor',
      prazo: '2026-11-10',
      vinculoProvidencia: true,
      responsavelNome: 'João Lima',
    });
    const linhas = montarLog(
      entrada(
        [p, prov],
        [
          {
            origem: 'pendencia',
            evento: ev({ itemId: 'p1', tipo: 'apontada', em: '2026-10-28T10:00:00' }),
          },
          {
            origem: 'pendencia',
            evento: ev({ itemId: 'p1', tipo: 'responsavel_alterado', em: '2026-10-28T11:00:00' }),
          },
          {
            origem: 'pendencia',
            evento: ev({ itemId: 'p1', tipo: 'resolvida', em: '2026-11-02T10:00:00' }),
          },
          {
            origem: 'tarefa',
            evento: ev({ itemId: 't9', tipo: 'criada', em: '2026-11-03T10:00:00' }),
          },
        ],
      ),
    );
    expect(linhas.map((l) => [l.origem, l.tipo, l.cor, l.detalhe])).toEqual([
      ['providencia', 'atribuida', 'neutra', 'para João L'],
      ['pendencia', 'resolvida', 'ok', 'no prazo'],
      ['pendencia', 'atribuida', 'neutra', 'para João L'],
      ['pendencia', 'apontada', 'neutra', 'prazo ter 03/11'],
    ]);
  });

  it('ignora eventos de item que não foi carregado e tipos fora do log', () => {
    const linhas = montarLog(
      entrada(
        [item({ id: 'a3', origem: 'atividade' })],
        [
          {
            origem: 'atividade',
            evento: ev({ itemId: 'a3', tipo: 'plano_recuperacao', em: '2026-11-03T10:00:00' }),
          },
          {
            origem: 'atividade',
            evento: ev({ itemId: 'a3', tipo: 'foto_anexada', em: '2026-11-03T10:00:00' }),
          },
          {
            origem: 'tarefa',
            evento: ev({ itemId: 'nao-existe', tipo: 'criada', em: '2026-11-03T10:00:00' }),
          },
        ],
      ),
    );
    expect(linhas).toEqual([]);
  });

  it('empate de horário ordena por origem e depois pelo texto', () => {
    const em = '2026-11-03T10:00:00';
    const linhas = montarLog(
      entrada(
        [
          item({ id: 'x', texto: 'B' }),
          item({ id: 'y', texto: 'A' }),
          item({ id: 'z', origem: 'atividade', texto: 'C' }),
        ],
        [
          { origem: 'tarefa', evento: ev({ itemId: 'x', tipo: 'criada', em }) },
          { origem: 'tarefa', evento: ev({ itemId: 'y', tipo: 'criada', em }) },
          { origem: 'atividade', evento: ev({ itemId: 'z', tipo: 'reaberta', em }) },
        ],
      ),
    );
    expect(linhas.map((l) => l.itemTexto)).toEqual(['C', 'A', 'B']);
  });
});

function linha(p: Partial<LinhaLog> & { id: string }): LinhaLog {
  return {
    em: '2026-11-04T10:00:00',
    dia: '2026-11-04',
    tipo: 'criada',
    origem: 'tarefa',
    itemId: 'i',
    itemTexto: 'x',
    obraId: 'o1',
    obraNome: 'Savassi',
    pessoa: null,
    pessoaId: null,
    detalhe: '',
    cor: 'neutra',
    ...p,
  };
}

describe('agruparPorDia', () => {
  it('agrupa na ordem das linhas e rotula "Quarta, 04/11"', () => {
    const grupos = agruparPorDia(
      [
        linha({ id: '1' }),
        linha({ id: '2' }),
        linha({ id: '3', dia: '2026-11-03', em: '2026-11-03T10:00:00' }),
      ],
      fmtCompleto,
    );
    expect(grupos.map((g) => [g.dia, g.rotulo, g.linhas.length])).toEqual([
      ['2026-11-04', 'Quarta, 04/11', 2],
      ['2026-11-03', 'Terça, 03/11', 1],
    ]);
  });
});

describe('filtrarLog', () => {
  const linhas = [
    linha({ id: '1', tipo: 'replanejada', cor: 'atencao' }),
    linha({ id: '2', tipo: 'inicio_ajustado', origem: 'atividade', obraId: 'o2' }),
    linha({
      id: '3',
      tipo: 'concluida',
      origem: 'pendencia',
      pessoa: 'Matheus T',
      pessoaId: 'u-matheus',
    }),
    linha({ id: '4', tipo: 'atribuida', origem: 'providencia' }),
    // Homônimo de nome curto, outra pessoa: o filtro por id não confunde.
    linha({ id: '5', tipo: 'criada', pessoa: 'Matheus T', pessoaId: 'u-outro' }),
  ];
  const ids = (ls: LinhaLog[]) => ls.map((l) => l.id);

  it('"replanejadas" só mantém replanejada e início ajustado', () => {
    expect(ids(filtrarLog(linhas, { tipo: 'replanejadas' }))).toEqual(['1', '2']);
  });
  it('por origem: atividades, tarefas (com providências) e pendências', () => {
    expect(ids(filtrarLog(linhas, { tipo: 'atividades' }))).toEqual(['2']);
    expect(ids(filtrarLog(linhas, { tipo: 'tarefas' }))).toEqual(['1', '4', '5']);
    expect(ids(filtrarLog(linhas, { tipo: 'pendencias' }))).toEqual(['3']);
  });
  it('por obra', () => {
    expect(ids(filtrarLog(linhas, { obraId: 'o2' }))).toEqual(['2']);
  });
  it('por pessoa (nome completo comparado pelo nome curto)', () => {
    expect(ids(filtrarLog(linhas, { pessoaNome: 'Matheus Teófilo' }))).toEqual(['3', '5']);
  });
  it('por pessoa pelo id (precede o nome)', () => {
    expect(
      ids(filtrarLog(linhas, { pessoaId: 'u-matheus', pessoaNome: 'Matheus Teófilo' })),
    ).toEqual(['3']);
  });
  it('sem filtro devolve tudo', () => {
    expect(filtrarLog(linhas, {})).toHaveLength(5);
  });
});

describe('vidaDoItem', () => {
  it('passos em ordem e resumo do atraso, replanejamentos e dias aberta', () => {
    const vida = vidaDoItem(tarefa, eventosTarefa, HOJE, fmt);
    expect(vida.passos.map((p) => [p.rotulo, p.detalhe, p.cor])).toEqual([
      ['Criada', 'prazo seg 26/10', 'neutra'],
      ['Replanejada 1x', 'de seg 26/10 para qua 28/10', 'atencao'],
      ['Replanejada 2x', 'de qua 28/10 para sex 30/10 · "faltou material"', 'atencao'],
      ['Concluída', '4 d.u. depois do prazo', 'ok'],
    ]);
    expect(vida.passos.map((p) => p.pessoa)).toEqual([
      'Ana P',
      'Matheus T',
      'Matheus T',
      'Matheus T',
    ]);
    expect(vida.resumo).toBe('4 d.u. além do prazo original · 2 replanejamentos · 8 dias aberta');
  });

  it('item aberto conta até hoje, com singulares, "vencida" e foto anexada', () => {
    const t = item({ id: 'a9', origem: 'atividade', prazo: '2026-11-02' });
    const vida = vidaDoItem(
      t,
      [
        ev({ itemId: 'a9', tipo: 'criada', em: '2026-11-02T09:00:00' }),
        ev({ itemId: 'a9', tipo: 'foto_anexada', em: '2026-11-03T10:00:00' }),
        ev({
          itemId: 'a9',
          tipo: 'inicio_ajustado',
          em: '2026-11-03T11:00:00',
          antes: { inicio_manual: '2026-10-28' },
          depois: { inicio_manual: '2026-10-29' },
        }),
        ev({ itemId: 'outro', tipo: 'replanejada', em: '2026-11-03T12:00:00' }),
      ],
      '2026-11-03',
      fmt,
    );
    expect(vida.passos.map((p) => [p.rotulo, p.cor])).toEqual([
      ['Criada', 'neutra'],
      ['Venceu', 'atraso'],
      ['Foto anexada', 'neutra'],
      ['Início ajustado', 'atencao'],
    ]);
    expect(vida.resumo).toBe('1 d.u. além do prazo original · 1 replanejamento · 1 dia aberta');
  });

  it('sem evento de criação na janela, conta os dias aberta desde criadaEm', () => {
    const t = item({
      id: 'v1',
      origem: 'atividade',
      prazo: '2026-12-01',
      criadaEm: '2026-10-05',
    });
    const vida = vidaDoItem(
      t,
      [ev({ itemId: 'v1', tipo: 'avanco', em: '2026-11-03T10:00:00', depois: { pct: 50 } })],
      HOJE,
      fmt,
    );
    expect(vida.resumo).toBe('0 d.u. além do prazo original · 0 replanejamentos · 30 dias aberta');
    // Sem eventos também usa criadaEm.
    expect(vidaDoItem(t, [], HOJE, fmt).resumo).toMatch(/30 dias aberta$/);
  });

  it('sem prazo nem eventos: tudo zero', () => {
    expect(vidaDoItem(item({ id: 'z' }), [], HOJE, fmt).resumo).toBe(
      '0 d.u. além do prazo original · 0 replanejamentos · 0 dias aberta',
    );
  });
});

describe('rotuloLinhaLog', () => {
  it('rótulos em pt-BR, a vencida por extenso', () => {
    expect(rotuloLinhaLog('replanejada')).toBe('Replanejada');
    expect(rotuloLinhaLog('inicio_ajustado')).toBe('Início ajustado');
    expect(rotuloLinhaLog('vencida')).toBe('Venceu sem concluir');
    expect(rotuloLinhaLog('atribuida')).toBe('Atribuída');
  });
});
