import { describe, expect, it } from 'vitest';
import { PRAZOS_PENDENCIA_PADRAO, prazoPendencia } from '@contro/core';
import { dataLocal } from '../obras/api';
import {
  eventosDoLog,
  eventosPorItem,
  itensDoLog,
  itensEquipe,
  itensPrestador,
  type DadosLogScore,
  type LinhaAtividadeLog,
  type LinhaPendenciaLog,
  type LinhaTarefaLog,
} from './itensLog';
import { inicioJanelaLog } from './dadosLogScore';

const tarefa = (o: Partial<LinhaTarefaLog> = {}): LinhaTarefaLog => ({
  id: 't1',
  obra_id: 'o1',
  texto: 'Comprar porcelanato',
  status: 'aberta',
  prazo: '2026-11-06',
  prazo_original: null,
  replanejamentos: 0,
  feita_em: null,
  responsavel_id: 'p1',
  responsavel_nome: null,
  responsavel: { nome: 'Ana Souza' },
  vinculo_tipo: null,
  vinculo_id: null,
  created_at: '2026-11-02T12:00:00Z',
  ...o,
});

const pendencia = (o: Partial<LinhaPendenciaLog> = {}): LinhaPendenciaLog => ({
  id: 'pd1',
  obra_id: 'o1',
  titulo: 'Rejunte manchado',
  criticidade: 'alta',
  apontada_em: '2026-11-02T13:00:00Z',
  resolvida_em: null,
  status: 'aberta',
  responsavel_id: 'p2',
  responsavel: { nome: 'Bruno Lima' },
  ...o,
});

const atividade = (o: Partial<LinhaAtividadeLog> = {}): LinhaAtividadeLog => ({
  id: 'a1',
  obra_id: 'o1',
  nome: 'Demolição',
  pai_id: null,
  concluida_em: null,
  prestador: 'Construtora Alfa',
  foto_conclusao_id: null,
  ...o,
});

const dados = (o: Partial<DadosLogScore> = {}): DadosLogScore => ({
  obras: [
    { id: 'o1', nome: 'Savassi', status: 'ativa' },
    { id: 'o2', nome: 'Pampulha', status: 'concluida' },
    { id: 'o3', nome: 'Centro', status: 'pausada' },
  ],
  atividades: [],
  tarefas: [],
  pendencias: [],
  fimPrevisto: {},
  prazos: PRAZOS_PENDENCIA_PADRAO,
  eventosTarefa: [],
  eventosPendencia: [],
  eventosAtividade: [],
  ...o,
});

describe('itensEquipe', () => {
  it('tarefa sem prazo_original usa o prazo como original', () => {
    const [i] = itensEquipe(dados({ tarefas: [tarefa()] }));
    expect(i).toMatchObject({
      id: 't1',
      origem: 'tarefa',
      obraNome: 'Savassi',
      chavePessoa: 'p1',
      nomePessoa: 'Ana Souza',
      prazo: '2026-11-06',
      prazoOriginal: '2026-11-06',
      concluidaEm: null,
      replanejamentos: 0,
      excluida: false,
    });
  });

  it('tarefa replanejada mantém o prazo_original e a conclusão', () => {
    const [i] = itensEquipe(
      dados({
        tarefas: [
          tarefa({
            prazo: '2026-11-10',
            prazo_original: '2026-11-04',
            replanejamentos: 2,
            status: 'feita',
            feita_em: '2026-11-09T15:00:00Z',
          }),
        ],
      }),
    );
    expect(i.prazoOriginal).toBe('2026-11-04');
    expect(i.prazo).toBe('2026-11-10');
    expect(i.replanejamentos).toBe(2);
    expect(i.concluidaEm).toBe('2026-11-09T15:00:00Z');
  });

  it('nome digitado sem login vira chave "nome:"; sem responsável fica fora', () => {
    const itens = itensEquipe(
      dados({
        tarefas: [
          tarefa({
            id: 't1',
            responsavel_id: null,
            responsavel: null,
            responsavel_nome: 'Zé Pedreiro',
          }),
          tarefa({ id: 't2', responsavel_id: null, responsavel: null, responsavel_nome: null }),
        ],
        pendencias: [pendencia({ responsavel_id: null, responsavel: null })],
      }),
    );
    expect(itens).toHaveLength(1);
    expect(itens[0].chavePessoa).toBe('nome:ze pedreiro');
    expect(itens[0].nomePessoa).toBe('Zé Pedreiro');
  });

  it('pendência tem prazo pela criticidade a partir do dia apontado', () => {
    const prazos = { alta: 1, media: 4, baixa: 6 };
    const p = pendencia({ criticidade: 'alta' });
    const [i] = itensEquipe(dados({ pendencias: [p], prazos }));
    const esperado = prazoPendencia('alta', dataLocal(p.apontada_em), prazos);
    expect(i).toMatchObject({
      origem: 'pendencia',
      texto: 'Rejunte manchado',
      chavePessoa: 'p2',
      nomePessoa: 'Bruno Lima',
      prazo: esperado,
      prazoOriginal: esperado,
      replanejamentos: 0,
    });
  });

  it('pendência resolvida usa resolvida_em como conclusão', () => {
    const [i] = itensEquipe(
      dados({
        pendencias: [pendencia({ status: 'fechada', resolvida_em: '2026-11-03T10:00:00Z' })],
      }),
    );
    expect(i.concluidaEm).toBe('2026-11-03T10:00:00Z');
  });

  it('itens de obra pausada ficam fora', () => {
    const itens = itensEquipe(
      dados({
        tarefas: [tarefa({ id: 't1', obra_id: 'o3' }), tarefa({ id: 't2', obra_id: 'o2' })],
        pendencias: [pendencia({ obra_id: 'o3' })],
      }),
    );
    expect(itens.map((i) => i.id)).toEqual(['t2']);
  });
});

describe('itensPrestador', () => {
  it('atividade de topo com foto: comFoto true e fim previsto do cronograma', () => {
    const [i] = itensPrestador(
      dados({
        atividades: [atividade({ concluida_em: '2026-11-03T18:00:00Z', foto_conclusao_id: 'f1' })],
        fimPrevisto: { a1: '2026-11-04' },
      }),
    );
    expect(i).toMatchObject({
      id: 'a1',
      obraNome: 'Savassi',
      texto: 'Demolição',
      prestador: 'Construtora Alfa',
      fimPrevisto: '2026-11-04',
      concluidaEm: '2026-11-03T18:00:00Z',
      comFoto: true,
      excluida: false,
    });
  });

  it('sem foto: comFoto false', () => {
    const [i] = itensPrestador(
      dados({ atividades: [atividade()], fimPrevisto: { a1: '2026-11-04' } }),
    );
    expect(i.comFoto).toBe(false);
  });

  it('prestador em branco, subitem, sem fim previsto e obra pausada ficam fora', () => {
    const itens = itensPrestador(
      dados({
        atividades: [
          atividade({ id: 'a1', prestador: '   ' }),
          atividade({ id: 'a2', prestador: null }),
          atividade({ id: 'a3', pai_id: 'a9' }),
          atividade({ id: 'a4' }),
          atividade({ id: 'a5', obra_id: 'o3' }),
          atividade({ id: 'a6', obra_id: 'o2' }),
        ],
        fimPrevisto: {
          a1: '2026-11-04',
          a2: '2026-11-04',
          a3: '2026-11-04',
          a5: '2026-11-04',
          a6: '2026-11-04',
        },
      }),
    );
    expect(itens.map((i) => i.id)).toEqual(['a6']);
  });
});

describe('itensDoLog', () => {
  it('tarefa ligada a providência é marcada', () => {
    const itens = itensDoLog(
      dados({
        tarefas: [
          tarefa({ id: 't1' }),
          tarefa({ id: 't2', vinculo_tipo: 'providencia', vinculo_id: 'pv1' }),
        ],
      }),
    );
    expect(itens.find((i) => i.id === 't1')?.vinculoProvidencia).toBeFalsy();
    expect(itens.find((i) => i.id === 't2')).toMatchObject({
      origem: 'tarefa',
      vinculoProvidencia: true,
    });
  });

  it('monta tarefa, pendência e atividade de topo; subitem e obra pausada ficam fora', () => {
    const itens = itensDoLog(
      dados({
        tarefas: [
          tarefa({
            prazo: '2026-11-10',
            prazo_original: '2026-11-04',
            status: 'feita',
            feita_em: '2026-11-09T15:00:00Z',
          }),
        ],
        pendencias: [pendencia(), pendencia({ id: 'pd2', obra_id: 'o3' })],
        atividades: [atividade(), atividade({ id: 'a2', pai_id: 'a1' })],
        fimPrevisto: { a1: '2026-11-05' },
      }),
    );
    expect(itens.map((i) => `${i.origem}:${i.id}`).sort()).toEqual([
      'atividade:a1',
      'pendencia:pd1',
      'tarefa:t1',
    ]);
    expect(itens.find((i) => i.id === 't1')).toMatchObject({
      prazo: '2026-11-10',
      prazoOriginal: '2026-11-04',
      aberta: false,
      concluidaEm: '2026-11-09T15:00:00Z',
      responsavelNome: 'Ana Souza',
      obraNome: 'Savassi',
    });
    expect(itens.find((i) => i.id === 'a1')).toMatchObject({
      texto: 'Demolição',
      prazo: '2026-11-05',
      aberta: true,
      excluida: false,
    });
    expect(itens.find((i) => i.id === 'pd1')).toMatchObject({
      texto: 'Rejunte manchado',
      aberta: true,
      responsavelNome: 'Bruno Lima',
    });
  });
});

describe('eventos', () => {
  it('converte as três tabelas em EventoBruto com o nome de quem mudou', () => {
    const d = dados({
      eventosTarefa: [
        {
          id: 'e1',
          tarefa_id: 't1',
          tipo: 'replanejada',
          por: 'p1',
          em: '2026-11-03T12:00:00Z',
          antes: { prazo: '2026-11-04' },
          depois: { prazo: '2026-11-06' },
          por_pessoa: { nome: 'Ana Souza' },
        },
      ],
      eventosPendencia: [
        {
          id: 'e2',
          pendencia_id: 'pd1',
          tipo: 'resolvida',
          por: null,
          em: '2026-11-03T13:00:00Z',
          dados: { foto_depois_id: 'f2' },
          por_pessoa: null,
        },
      ],
      eventosAtividade: [
        {
          id: 'e3',
          atividade_id: 'a1',
          tipo: 'concluida',
          por: 'p2',
          em: '2026-11-03T14:00:00Z',
          antes: null,
          depois: { foto_id: 'f1' },
          por_pessoa: { nome: 'Bruno Lima' },
        },
      ],
    });
    const evs = eventosDoLog(d);
    expect(evs).toEqual([
      {
        origem: 'tarefa',
        evento: {
          id: 'e1',
          itemId: 't1',
          tipo: 'replanejada',
          por: 'p1',
          porNome: 'Ana Souza',
          em: '2026-11-03T12:00:00Z',
          antes: { prazo: '2026-11-04' },
          depois: { prazo: '2026-11-06' },
        },
      },
      {
        origem: 'pendencia',
        evento: {
          id: 'e2',
          itemId: 'pd1',
          tipo: 'resolvida',
          por: null,
          porNome: null,
          em: '2026-11-03T13:00:00Z',
          antes: null,
          depois: { foto_depois_id: 'f2' },
        },
      },
      {
        origem: 'atividade',
        evento: {
          id: 'e3',
          itemId: 'a1',
          tipo: 'concluida',
          por: 'p2',
          porNome: 'Bruno Lima',
          em: '2026-11-03T14:00:00Z',
          antes: null,
          depois: { foto_id: 'f1' },
        },
      },
    ]);
    const mapa = eventosPorItem(evs);
    expect(mapa.get('t1')?.map((e) => e.id)).toEqual(['e1']);
    expect(mapa.get('a1')?.map((e) => e.id)).toEqual(['e3']);
  });
});

describe('inicioJanelaLog', () => {
  it('volta 90 dias corridos', () => {
    expect(inicioJanelaLog('2026-11-04')).toBe('2026-08-06');
  });
});
