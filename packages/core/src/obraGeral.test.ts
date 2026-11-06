import { describe, expect, it } from 'vitest';
import {
  acoesCompletasObraGeral,
  acoesDaObraGeral,
  vinculosComTarefaAberta,
  type TarefaAcaoGeral,
  agendaObraGeral,
  detalheItemGeral,
  eficienciaObraGeral,
  textoAcoesBloco,
  textoEficiencia,
  atalhosDataPrevista,
  diaCurto,
  podePlanejarObraGeral,
  prazoAtividadeGeral,
  resumoObraGeral,
  statusAtividadeGeral,
  trilhaObraGeral,
  type AtividadeGeral,
  type FaseGeral,
} from './obraGeral';

const hoje = '2026-11-05'; // quinta

function ativ(p: Partial<AtividadeGeral> & { id: string }): AtividadeGeral {
  return {
    fase_id: 'f1',
    pai_id: null,
    ordem: 1,
    nome: p.id,
    data_prevista: null,
    data_prevista_original: null,
    replanejamentos: 0,
    responsavel_id: null,
    concluida_em: null,
    avanco_pct: 0,
    foto_conclusao_id: null,
    prestador: null,
    ...p,
  };
}

const fases = [{ id: 'f1', ordem: 1, titulo: 'Demolição' }];

describe('diaCurto', () => {
  it('formata dia da semana e data', () => {
    expect(diaCurto('2026-11-04')).toBe('qua 04/11');
    expect(diaCurto('2026-11-07')).toBe('sáb 07/11');
  });
});

describe('prazoAtividadeGeral', () => {
  it('usa a maior data dos subitens', () => {
    const subs = [
      ativ({ id: 's1', data_prevista: '2026-11-06' }),
      ativ({ id: 's2', data_prevista: null }),
      ativ({ id: 's3', data_prevista: '2026-11-09' }),
    ];
    expect(prazoAtividadeGeral(ativ({ id: 'a' }), subs)).toBe('2026-11-09');
  });
  it('cai na data da atividade quando os subitens não têm data', () => {
    const subs = [ativ({ id: 's1' })];
    expect(prazoAtividadeGeral(ativ({ id: 'a', data_prevista: '2026-11-10' }), subs)).toBe(
      '2026-11-10',
    );
  });
  it('é nulo sem subitens e sem data', () => {
    expect(prazoAtividadeGeral(ativ({ id: 'a' }), [])).toBeNull();
  });
});

describe('statusAtividadeGeral', () => {
  it('atrasada, vence hoje, aberta', () => {
    expect(statusAtividadeGeral(null, '2026-11-04', hoje)).toBe('atrasada');
    expect(statusAtividadeGeral(null, '2026-11-05', hoje)).toBe('vence_hoje');
    expect(statusAtividadeGeral(null, '2026-11-06', hoje)).toBe('aberta');
    expect(statusAtividadeGeral(null, null, hoje)).toBe('aberta');
  });
  it('concluída vence tudo', () => {
    expect(statusAtividadeGeral('2026-11-01T10:00:00Z', '2026-10-01', hoje)).toBe('concluida');
  });
  it('prazo na sexta com hoje no sábado está atrasada', () => {
    expect(statusAtividadeGeral(null, '2026-11-06', '2026-11-07')).toBe('atrasada');
  });
});

describe('trilhaObraGeral', () => {
  const base = {
    fases,
    hoje,
    pessoaId: 'eu',
    nomes: { carlos: 'Carlos', eu: 'Luiz' },
  };

  it('monta o sub de cada atividade e conta atrasadas e vence hoje', () => {
    const [f] = trilhaObraGeral({
      ...base,
      atividades: [
        ativ({ id: 'a1', ordem: 1, responsavel_id: 'carlos', data_prevista: '2026-11-04' }),
        ativ({ id: 'a2', ordem: 2, responsavel_id: 'eu', data_prevista: '2026-11-05' }),
        ativ({ id: 'a3', ordem: 3 }),
      ],
    });
    expect(f.atividades.map((a) => a.sub)).toEqual([
      'Carlos · era para qua 04/11',
      'Você · vence hoje',
      'Sem responsável · sem data',
    ]);
    expect(f.atrasadas).toBe(1);
    expect(f.venceHoje).toBe(1);
    expect(f.total).toBe(3);
    expect(f.n).toBe(1);
  });

  it('aberta com prazo mostra o dia; nome desconhecido vira sem responsável', () => {
    const [f] = trilhaObraGeral({
      ...base,
      atividades: [ativ({ id: 'a1', responsavel_id: 'x', data_prevista: '2026-11-06' })],
    });
    expect(f.atividades[0].sub).toBe('Sem responsável · sex 06/11');
  });

  it('concluída sem foto e com foto', () => {
    const [f] = trilhaObraGeral({
      ...base,
      atividades: [
        ativ({
          id: 'a1',
          ordem: 1,
          responsavel_id: 'carlos',
          concluida_em: '2026-11-03T10:00:00Z',
        }),
        ativ({
          id: 'a2',
          ordem: 2,
          responsavel_id: 'carlos',
          concluida_em: '2026-11-03T10:00:00Z',
          foto_conclusao_id: 'foto',
        }),
      ],
    });
    expect(f.atividades[0].sub.endsWith('concluída sem foto')).toBe(true);
    expect(f.atividades[0].semFoto).toBe(true);
    expect(f.atividades[1].sub).toBe('Carlos · concluída');
    expect(f.atividades[1].semFoto).toBe(false);
    expect(f.concluidas).toBe(2);
    expect(f.concluida).toBe(true);
  });

  it('ordena fases, atividades e subitens e deriva o prazo dos subitens', () => {
    const r = trilhaObraGeral({
      ...base,
      fases: [
        { id: 'f2', ordem: 2, titulo: 'Segunda' },
        { id: 'f1', ordem: 1, titulo: 'Primeira' },
      ],
      atividades: [
        ativ({ id: 'a2', ordem: 2 }),
        ativ({ id: 'a1', ordem: 1 }),
        ativ({ id: 's2', pai_id: 'a1', ordem: 2, data_prevista: '2026-11-09' }),
        ativ({ id: 's1', pai_id: 'a1', ordem: 1 }),
      ],
    });
    expect(r.map((f) => [f.id, f.n])).toEqual([
      ['f1', 1],
      ['f2', 2],
    ]);
    expect(r[0].total).toBe(2);
    const [a1, a2] = r[0].atividades;
    expect([a1.id, a2.id]).toEqual(['a1', 'a2']);
    expect(a1.prazo).toBe('2026-11-09');
    expect(a1.subitens.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(a1.subitens.map((s) => s.prazoTxt)).toEqual([null, 'seg 09/11']);
  });
});

describe('resumoObraGeral', () => {
  const f = (p: Partial<FaseGeral>): FaseGeral => ({
    id: 'x',
    n: 1,
    titulo: 't',
    total: 1,
    concluidas: 0,
    atrasadas: 0,
    venceHoje: 0,
    concluida: false,
    atividades: [],
    ...p,
  });
  it('cobre as quatro formas', () => {
    expect(resumoObraGeral([])).toBe('Nenhuma fase ainda');
    expect(resumoObraGeral([f({ concluida: true }), f({ n: 2, concluida: true })])).toBe(
      'Todas as fases concluídas',
    );
    expect(resumoObraGeral([f({ concluida: true }), f({ n: 2 }), f({ n: 3 })])).toBe('Fase 2 de 3');
    expect(resumoObraGeral([f({ atrasadas: 1 }), f({ n: 2 })])).toBe(
      'Fase 1 de 2 · 1 atividade atrasada',
    );
    expect(resumoObraGeral([f({ atrasadas: 1 }), f({ n: 2, atrasadas: 2 })])).toBe(
      'Fase 1 de 2 · 3 atividades atrasadas',
    );
  });
});

describe('atalhosDataPrevista', () => {
  it('quinta', () => {
    expect(atalhosDataPrevista('2026-11-05')).toEqual([
      { valor: '2026-11-05', rotulo: 'Hoje' },
      { valor: '2026-11-06', rotulo: 'Amanhã' },
      { valor: '2026-11-09', rotulo: 'Seg 09/11' },
      { valor: '2026-11-10', rotulo: 'Ter 10/11' },
    ]);
  });
  it('sexta', () => {
    const r = atalhosDataPrevista('2026-11-06');
    expect(r[1]).toEqual({ valor: '2026-11-07', rotulo: 'Amanhã' });
    expect(r.slice(2).map((a) => a.rotulo)).toEqual(['Seg 09/11', 'Ter 10/11']);
  });
});

describe('podePlanejarObraGeral', () => {
  it('administrador e coordenador planejam; membro não', () => {
    expect(
      podePlanejarObraGeral({ administrador: true, acessoContorno: false, papelGeral: null }),
    ).toBe(true);
    expect(
      podePlanejarObraGeral({
        administrador: false,
        acessoContorno: false,
        papelGeral: 'coordenador',
      }),
    ).toBe(true);
    expect(
      podePlanejarObraGeral({ administrador: false, acessoContorno: false, papelGeral: 'membro' }),
    ).toBe(false);
  });
});

describe('agendaObraGeral', () => {
  const nomes = { c: 'Carlos', p: 'Paula' };
  const agenda = (atividades: AtividadeGeral[]) =>
    agendaObraGeral({ atividades, hoje, pessoaId: 'p', nomes });

  it('separa atrasadas e as de hoje, com os textos de linha', () => {
    const r = agenda([
      ativ({ id: 'a1', data_prevista: '2026-11-04', responsavel_id: 'c' }),
      ativ({ id: 'a2', data_prevista: hoje, responsavel_id: 'p' }),
      ativ({ id: 'a3', data_prevista: hoje }),
    ]);
    expect(r.atrasados).toHaveLength(1);
    expect(r.atrasados[0]).toMatchObject({
      tipo: 'concluir',
      chave: 'geral:a1',
      nome: 'a1',
      data: '2026-11-04',
      atraso: true,
      pessoa: 'Carlos',
    });
    expect(detalheItemGeral(r.atrasados[0])).toBe('Carlos · devia terminar qua 04/11');
    expect(r.hoje.map((i) => detalheItemGeral(i))).toEqual([
      'Você · previsto concluir hoje',
      'Sem responsável · previsto concluir hoje',
    ]);
  });

  it('deixa de fora sem data, concluídas, futuras e subitens', () => {
    const r = agenda([
      ativ({ id: 'a1' }),
      ativ({ id: 'a2', data_prevista: '2026-11-04', concluida_em: '2026-11-04T10:00:00Z' }),
      ativ({ id: 'a3', data_prevista: '2026-11-10' }),
      ativ({ id: 'a4', pai_id: 'a2', data_prevista: '2026-11-01' }),
    ]);
    expect(r.atrasados).toEqual([]);
    expect(r.hoje).toEqual([]);
  });

  it('usa o último subitem como prazo e ordena atrasados por prazo e nome', () => {
    const r = agenda([
      ativ({ id: 'b', nome: 'B', data_prevista: '2026-11-03' }),
      ativ({ id: 'a', nome: 'A', data_prevista: '2026-11-03' }),
      ativ({ id: 'p', nome: 'Pai', data_prevista: '2026-11-20' }),
      ativ({ id: 's1', pai_id: 'p', data_prevista: '2026-11-02' }),
      ativ({ id: 's2', pai_id: 'p', data_prevista: '2026-11-01' }),
    ]);
    expect(r.atrasados.map((i) => i.nome)).toEqual(['Pai', 'A', 'B']);
    expect(r.atrasados[0].data).toBe('2026-11-02');
  });
});

describe('acoesDaObraGeral', () => {
  it('vira uma ação por atividade de topo com prazo', () => {
    const r = acoesDaObraGeral(
      [
        ativ({ id: 'a1', data_prevista: '2026-11-04', responsavel_id: 'c' }),
        ativ({ id: 'a2', data_prevista: '2026-11-06', concluida_em: '2026-11-05T12:00:00Z' }),
        ativ({ id: 'a3' }),
        ativ({ id: 's1', pai_id: 'a1', data_prevista: '2026-11-09' }),
      ],
      'o1',
      'Obra',
      { c: 'Carlos' },
    );
    expect(r).toEqual([
      {
        origem: 'atividade',
        id: 'a1',
        obraId: 'o1',
        texto: 'a1',
        prazo: '2026-11-09',
        aberta: true,
        responsavelId: 'c',
        responsavelNome: 'Carlos',
        concluidaEm: null,
      },
      {
        origem: 'atividade',
        id: 'a2',
        obraId: 'o1',
        texto: 'a2',
        prazo: '2026-11-06',
        aberta: false,
        responsavelId: null,
        responsavelNome: null,
        concluidaEm: '2026-11-05T12:00:00Z',
      },
    ]);
  });
});

describe('eficienciaObraGeral', () => {
  const concl = (id: string, prazo: string, em: string, extra?: Partial<AtividadeGeral>) =>
    ativ({ id, data_prevista: prazo, concluida_em: em, ...extra });

  it('conta concluídas no prazo e abertas atrasadas', () => {
    const r = eficienciaObraGeral(
      [
        concl('a', '2026-11-02', '2026-11-02T10:00:00'),
        concl('b', '2026-11-03', '2026-11-02T10:00:00'),
        concl('c', '2026-11-02', '2026-11-04T10:00:00'),
        ativ({ id: 'd', data_prevista: '2026-11-03' }),
        ativ({ id: 'e', data_prevista: '2026-11-09' }),
      ],
      hoje,
    );
    expect(r).toEqual({ noPrazo: 2, total: 4, pct: 50 });
    expect(textoEficiencia(r)).toBe('50% no prazo');
  });

  it('usa o prazo original: replanejada concluída depois da original fica fora', () => {
    const r = eficienciaObraGeral(
      [
        concl('a', '2026-11-04', '2026-11-04T10:00:00', {
          data_prevista_original: '2026-11-02',
        }),
      ],
      hoje,
    );
    expect(r).toEqual({ noPrazo: 0, total: 1, pct: 0 });
  });

  it('sem nada vencido nem concluído não há porcentagem', () => {
    const r = eficienciaObraGeral(
      [ativ({ id: 'a', data_prevista: '2026-11-09' }), ativ({ id: 'b' })],
      hoje,
    );
    expect(r).toEqual({ noPrazo: 0, total: 0, pct: null });
    expect(textoEficiencia(r)).toBeNull();
  });

  it('sem original na atividade, com subitens: o maior original (ou data) entre os subitens', () => {
    const sub = (id: string, extra: Partial<AtividadeGeral>) =>
      ativ({ id, pai_id: 'a', concluida_em: '2026-11-04T10:00:00', ...extra });
    // Subitem replanejado de 03/11 para 06/11: o original é 03/11; o outro vai até 02/11.
    // Concluída em 04/11, depois do original 03/11: fora do prazo (a data dela, 06/11, não conta).
    const r = eficienciaObraGeral(
      [
        concl('a', '2026-11-06', '2026-11-04T10:00:00'),
        sub('a1', { data_prevista: '2026-11-06', data_prevista_original: '2026-11-03' }),
        sub('a2', { data_prevista: '2026-11-02' }),
      ],
      hoje,
    );
    expect(r).toEqual({ noPrazo: 0, total: 1, pct: 0 });
  });

  it('sem original na atividade: subitens sem replanejar dão o maior prazo deles', () => {
    const r = eficienciaObraGeral(
      [
        concl('a', '2026-11-02', '2026-11-04T10:00:00'),
        ativ({ id: 'a1', pai_id: 'a', data_prevista: '2026-11-04' }),
        ativ({ id: 'a2', pai_id: 'a', data_prevista: '2026-11-03' }),
      ],
      hoje,
    );
    expect(r).toEqual({ noPrazo: 1, total: 1, pct: 100 });
  });

  it('original da própria atividade vale mais que os subitens', () => {
    const r = eficienciaObraGeral(
      [
        concl('a', '2026-11-06', '2026-11-04T10:00:00', { data_prevista_original: '2026-11-02' }),
        ativ({ id: 'a1', pai_id: 'a', data_prevista: '2026-11-06' }),
      ],
      hoje,
    );
    expect(r).toEqual({ noPrazo: 0, total: 1, pct: 0 });
  });

  it('subitens sem data: usa a data da atividade', () => {
    const r = eficienciaObraGeral(
      [concl('a', '2026-11-04', '2026-11-04T10:00:00'), ativ({ id: 'a1', pai_id: 'a' })],
      hoje,
    );
    expect(r).toEqual({ noPrazo: 1, total: 1, pct: 100 });
  });
});

describe('textoAcoesBloco', () => {
  const ac = (id: string, prazo: string, resp: string | null, aberta = true) => ({
    origem: 'atividade' as const,
    id,
    obraId: 'o1',
    texto: id,
    prazo,
    aberta,
    responsavelId: resp,
    responsavelNome: null,
  });
  const lista = [
    ac('1', '2026-11-04', 'p'),
    ac('2', hoje, 'p'),
    ac('3', hoje, 'x'),
    ac('4', '2026-11-09', 'x'),
    ac('5', '2026-11-01', 'x', false),
  ];

  it('modo equipe', () => {
    expect(textoAcoesBloco(lista, hoje, 'p', false)).toEqual({
      principal: '4 abertas na obra',
      detalhe: '1 atrasada',
      atrasadas: 1,
    });
  });
  it('modo da pessoa, com atrasadas e vencendo hoje', () => {
    expect(textoAcoesBloco(lista, hoje, 'p', true)).toEqual({
      principal: '2 suas abertas',
      detalhe: '1 atrasada',
      atrasadas: 1,
    });
  });
  it('singular, plural e vence hoje', () => {
    expect(textoAcoesBloco([ac('2', hoje, 'p')], hoje, 'p', true)).toEqual({
      principal: '1 sua aberta',
      detalhe: '1 vence hoje',
      atrasadas: 0,
    });
    expect(textoAcoesBloco([ac('2', hoje, 'p'), ac('3', hoje, 'p')], hoje, 'p', true).detalhe).toBe(
      '2 vencem hoje',
    );
    expect(
      textoAcoesBloco([ac('1', '2026-11-01', 'p'), ac('2', '2026-11-02', 'p')], hoje, 'p', false),
    ).toMatchObject({ principal: '2 abertas na obra', detalhe: '2 atrasadas' });
  });
  it('sem nada a destacar não há detalhe', () => {
    expect(textoAcoesBloco([ac('4', '2026-11-09', 'p')], hoje, 'p', true)).toEqual({
      principal: '1 sua aberta',
      detalhe: null,
      atrasadas: 0,
    });
  });
});

describe('acoesCompletasObraGeral', () => {
  const tarefa = (p: Partial<TarefaAcaoGeral> & { id: string }): TarefaAcaoGeral => ({
    texto: p.id,
    prazo: hoje,
    status: 'aberta',
    responsavel_id: null,
    responsavelNome: null,
    vinculo_tipo: null,
    vinculo_id: null,
    feita_em: null,
    ...p,
  });
  const base = {
    obraId: 'o1',
    nomes: { c: 'Carlos Lima', p: 'Paula' },
    tarefas: [] as TarefaAcaoGeral[],
    pendencias: [],
    providencias: [],
  };

  it('junta atividades, tarefas, pendências e providências com os mesmos nomes', () => {
    const r = acoesCompletasObraGeral({
      ...base,
      atividades: [
        ativ({ id: 'a1', data_prevista: '2026-11-04', responsavel_id: 'c' }),
        ativ({ id: 's1', pai_id: 'a1', data_prevista: '2026-11-03' }),
      ],
      tarefas: [tarefa({ id: 't1', responsavel_id: 'p', responsavelNome: 'Paula' })],
      pendencias: [
        {
          id: 'pe1',
          titulo: 'Rodapé solto',
          criticidade: 'alta',
          status: 'aberta',
          apontada_em: '2026-11-02T12:00:00',
          responsavel_id: 'c',
          responsavelNome: 'Carlos L',
          resolvida_em: null,
        },
      ],
      providencias: [
        {
          id: 'pv1',
          atividade_id: 's1',
          tipo: 'compra',
          descricao: 'Tinta',
          status: 'pendente',
          providenciar_ate: '2026-11-02',
        },
      ],
      prazosPendencia: { alta: 1, media: 4, baixa: 6 },
    });
    expect(r.map((a) => [a.origem, a.id, a.prazo, a.responsavelNome])).toEqual([
      ['atividade', 'a1', '2026-11-03', 'Carlos Lima'],
      ['tarefa', 't1', hoje, 'Paula'],
      ['pendencia', 'pe1', '2026-11-03', 'Carlos Lima'],
      ['providencia', 'pv1', '2026-11-02', 'Carlos Lima'],
    ]);
    // Providência de subitem: dono e atividade a abrir são os da atividade de topo.
    expect(r[3]).toMatchObject({ texto: 'Compra: Tinta', responsavelId: 'c', atividadeId: 'a1' });
    expect(r[0]!.atividadeId).toBe('a1');
  });

  it('não repete a atividade nem a providência com tarefa vinculada aberta', () => {
    const prov = (id: string, descricao: string) => ({
      id,
      atividade_id: 'a3',
      tipo: 'compra' as const,
      descricao,
      status: 'pendente' as const,
      providenciar_ate: hoje,
    });
    const r = acoesCompletasObraGeral({
      ...base,
      atividades: [
        ativ({ id: 'a1', data_prevista: hoje }),
        ativ({ id: 'a2', data_prevista: hoje, concluida_em: '2026-11-05T10:00:00Z' }),
        ativ({ id: 'a3', data_prevista: hoje }),
      ],
      providencias: [prov('pv1', 'Cabos'), prov('pv2', 'Andaime')],
      tarefas: [
        tarefa({ id: 't1', vinculo_tipo: 'atividade', vinculo_id: 'a1' }),
        // Concluir a atividade fecha a tarefa junto: a atividade concluída continua.
        tarefa({ id: 't2', vinculo_tipo: 'atividade', vinculo_id: 'a2', status: 'feita' }),
        tarefa({ id: 't3', vinculo_tipo: 'providencia', vinculo_id: 'pv1' }),
        // Tarefa feita não representa a atividade aberta.
        tarefa({ id: 't4', vinculo_tipo: 'atividade', vinculo_id: 'a3', status: 'feita' }),
      ],
    });
    expect(r.map((a) => `${a.origem}:${a.id}`)).toEqual([
      'atividade:a2',
      'atividade:a3',
      'tarefa:t1',
      'tarefa:t2',
      'tarefa:t3',
      'tarefa:t4',
      'providencia:pv2',
    ]);
  });

  it('deixa fora providência feita, sem prazo ou de atividade concluída', () => {
    const prov = (id: string, atividade_id: string, extra: object = {}) => ({
      id,
      atividade_id,
      tipo: 'contratacao' as const,
      descricao: id,
      status: 'pendente' as const,
      providenciar_ate: hoje as string | null,
      ...extra,
    });
    const r = acoesCompletasObraGeral({
      ...base,
      atividades: [
        ativ({ id: 'a1', data_prevista: hoje }),
        ativ({ id: 'a2', data_prevista: hoje, concluida_em: '2026-11-05T10:00:00Z' }),
      ],
      providencias: [
        prov('pv1', 'a1', { status: 'feito' }),
        prov('pv2', 'a1', { providenciar_ate: null }),
        prov('pv3', 'a2'),
        prov('pv4', 'sumiu'),
        prov('pv5', 'a1'),
      ],
    });
    expect(r.filter((a) => a.origem === 'providencia').map((a) => a.id)).toEqual(['pv5']);
    expect(r.find((a) => a.id === 'pv5')!.responsavelNome).toBeNull();
  });

  it('pendência resolvida fica concluída com a data de resolução', () => {
    const r = acoesCompletasObraGeral({
      ...base,
      atividades: [],
      pendencias: [
        {
          id: 'pe1',
          titulo: 'Trinca',
          criticidade: 'baixa',
          status: 'fechada',
          apontada_em: '2026-11-02T12:00:00',
          resolvida_em: '2026-11-04T12:00:00Z',
        },
      ],
    });
    expect(r[0]).toMatchObject({
      aberta: false,
      responsavelId: null,
      responsavelNome: null,
      prazo: '2026-11-10',
      concluidaEm: '2026-11-04T12:00:00Z',
    });
  });

  it('vinculosComTarefaAberta só conta tarefa aberta com vínculo', () => {
    const v = vinculosComTarefaAberta([
      tarefa({ id: 't1', vinculo_tipo: 'atividade', vinculo_id: 'a1' }),
      tarefa({ id: 't2', vinculo_tipo: 'providencia', vinculo_id: 'p1' }),
      tarefa({ id: 't3', vinculo_tipo: 'providencia', vinculo_id: 'p2', status: 'feita' }),
    ]);
    expect([...v.atividades]).toEqual(['a1']);
    expect([...v.providencias]).toEqual(['p1']);
  });
});

describe('agendaObraGeral com as ações completas', () => {
  it('põe tarefas, pendências e providências vencidas ou de hoje como ação', () => {
    const t = {
      status: 'aberta' as const,
      vinculo_tipo: null,
      vinculo_id: null,
      feita_em: null,
    };
    const acoes = acoesCompletasObraGeral({
      obraId: 'o1',
      nomes: { p: 'Paula' },
      atividades: [ativ({ id: 'a1', nome: 'Pintura', data_prevista: hoje, responsavel_id: 'p' })],
      tarefas: [
        {
          ...t,
          id: 't1',
          texto: 'Pedir tinta',
          prazo: '2026-11-04',
          responsavel_id: 'p',
          responsavelNome: 'Paula',
        },
        {
          ...t,
          id: 't2',
          texto: 'Futuro',
          prazo: '2026-11-09',
          responsavel_id: null,
          responsavelNome: null,
        },
      ],
      pendencias: [],
      providencias: [
        {
          id: 'pv1',
          atividade_id: 'a1',
          tipo: 'compra',
          descricao: 'Rolo',
          status: 'pendente',
          providenciar_ate: hoje,
        },
      ],
    });
    const r = agendaObraGeral({ atividades: [], hoje, pessoaId: 'x', nomes: {}, acoes });
    expect(r.atrasados.map((i) => [i.chave, i.tipo, detalheItemGeral(i)])).toEqual([
      ['tarefa:t1', 'acao', 'Paula · venceu qua 04/11'],
    ]);
    expect(r.hoje.map((i) => [i.chave, i.tipo, detalheItemGeral(i)])).toEqual([
      ['providencia:pv1', 'acao', 'Paula · até hoje'],
      ['geral:a1', 'concluir', 'Paula · previsto concluir hoje'],
    ]);
  });
});
