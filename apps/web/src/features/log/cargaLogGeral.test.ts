import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tabelas: {} as Record<string, unknown[]>,
  erros: {} as Record<string, { message: string }>,
  filtros: {} as Record<string, unknown[][]>,
  rpc: vi.fn(),
}));

vi.mock('../../lib/supabase', () => {
  const cadeia = (tabela: string) => {
    const filtros: unknown[][] = [];
    mocks.filtros[tabela] ??= [];
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'is', 'or', 'gte', 'order', 'range', 'returns'])
      c[m] = (...args: unknown[]) => {
        if (m === 'eq' || m === 'in') filtros.push([m, ...args]);
        return c;
      };
    c.then = (ok: (r: unknown) => unknown) => {
      mocks.filtros[tabela]!.push(...filtros);
      return Promise.resolve({
        data: mocks.erros[tabela] ? null : (mocks.tabelas[tabela] ?? []),
        error: mocks.erros[tabela] ?? null,
      }).then(ok);
    };
    return c;
  };
  return { supabase: { from: cadeia, rpc: mocks.rpc } };
});

import { calcularScoreEquipe, montarLog } from '@contro/core';
import { loadDadosLogScore } from './dadosLogScore';
import { eventosDoLog, itensDoLog, itensEquipe, itensPrestador } from './itensLog';

const DESDE = '2026-08-08';
const HOJE = '2026-11-06'; // sexta
const fmt = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7);

function ativ(o: Record<string, unknown>) {
  return {
    fase_id: 'f1',
    pai_id: null,
    ordem: 1,
    data_prevista: '2026-10-28',
    data_prevista_original: null,
    replanejamentos: 0,
    responsavel_id: null,
    concluida_em: null,
    avanco_pct: 0,
    foto_conclusao_id: null,
    prestador: null,
    ...o,
  };
}

function evA(o: Record<string, unknown>) {
  return { por: 'p1', antes: null, depois: null, por_pessoa: { nome: 'Bia Lima' }, ...o };
}

beforeEach(() => {
  mocks.erros = {};
  mocks.filtros = {};
  mocks.rpc.mockReset();
  mocks.rpc.mockResolvedValue({
    data: { pend_alta_du: 1, pend_media_du: 3, pend_baixa_du: 5 },
    error: null,
  });
  mocks.tabelas = {
    obra: [
      { id: 'g1', nome: 'Galpão SMS', inicio: '2026-09-01', status: 'ativa', ambiente: 'geral' },
      { id: 'g2', nome: 'Depósito', inicio: '2026-09-10', status: 'ativa', ambiente: 'geral' },
      // Concluída sem nada na janela: fica fora.
      { id: 'g3', nome: 'Antiga', inicio: '2026-01-10', status: 'concluida', ambiente: 'geral' },
    ],
    obra_atividade: [
      ativ({
        id: 'a1',
        obra_id: 'g1',
        nome: 'Pintura',
        data_prevista: '2026-10-30',
        data_prevista_original: '2026-10-28',
        responsavel_id: 'p1',
        concluida_em: '2026-11-03T15:00:00Z',
      }),
      ativ({ id: 's1', obra_id: 'g1', pai_id: 'a1', nome: 'Massa', data_prevista: '2026-10-30' }),
      ativ({ id: 'a2', obra_id: 'g2', nome: 'Piso', data_prevista: '2026-11-20' }),
      ativ({
        id: 'a3',
        obra_id: 'g3',
        nome: 'Forro',
        concluida_em: '2026-02-01T12:00:00Z',
      }),
    ],
    tarefa: [
      {
        id: 't1',
        obra_id: 'g1',
        texto: 'Comprar tinta',
        status: 'aberta',
        prazo: '2026-11-04',
        prazo_original: '2026-11-02',
        replanejamentos: 9,
        feita_em: null,
        responsavel_id: null,
        responsavel_nome: 'Seu Zé',
        responsavel: null,
        vinculo_tipo: null,
        vinculo_id: null,
        created_at: '2026-10-30T12:00:00Z',
      },
    ],
    pendencia: [
      {
        id: 'pd1',
        obra_id: 'g1',
        titulo: 'Mancha',
        criticidade: 'alta',
        apontada_em: '2026-11-02T13:00:00Z',
        resolvida_em: null,
        status: 'aberta',
        responsavel_id: 'p2',
        responsavel: { nome: 'Caio Mendes' },
      },
      {
        id: 'pd2',
        obra_id: 'g2',
        titulo: 'Trinca',
        criticidade: 'alta',
        apontada_em: '2026-11-02T13:00:00Z',
        resolvida_em: null,
        status: 'aberta',
        responsavel_id: 'p2',
        responsavel: { nome: 'Caio Mendes' },
      },
    ],
    tarefa_evento: [
      {
        id: 'te1',
        tarefa_id: 't1',
        tipo: 'replanejada',
        por: 'p1',
        em: '2026-11-03T12:00:00Z',
        antes: { prazo: '2026-11-02' },
        depois: { prazo: '2026-11-04' },
        por_pessoa: { nome: 'Bia Lima' },
      },
    ],
    pendencia_evento: [],
    obra_atividade_evento: [
      evA({
        id: 'e1',
        atividade_id: 'a1',
        tipo: 'replanejada',
        em: '2026-10-20T12:00:00Z',
        antes: { data: '2026-10-28' },
        depois: { data: '2026-10-29' },
      }),
      evA({
        id: 'e2',
        atividade_id: 's1',
        tipo: 'replanejada',
        em: '2026-10-21T12:00:00Z',
        antes: { data: '2026-10-25' },
        depois: { data: '2026-10-29' },
      }),
      evA({
        id: 'e3',
        atividade_id: 'a1',
        tipo: 'replanejada',
        em: '2026-10-22T12:00:00Z',
        antes: { data: '2026-10-29' },
        depois: { data: '2026-10-30' },
      }),
      evA({
        id: 'e4',
        atividade_id: 'a1',
        tipo: 'data_desfeita',
        em: '2026-10-22T12:01:00Z',
        depois: { data: '2026-10-29', evento_id: 'e3' },
      }),
      // Atividade excluída (fora da carga): não conta.
      evA({ id: 'e5', atividade_id: 'xx', tipo: 'replanejada', em: '2026-10-22T12:00:00Z' }),
      evA({
        id: 'e6',
        atividade_id: 'a1',
        tipo: 'concluida',
        por: 'p2',
        em: '2026-11-03T15:00:00Z',
        depois: { responsavel_id: 'p1' },
        por_pessoa: { nome: 'Caio Mendes' },
      }),
      evA({
        id: 'e7',
        atividade_id: 'a1',
        tipo: 'responsavel',
        em: '2026-10-19T12:00:00Z',
        antes: { responsavel_id: 'p2' },
        depois: { responsavel_id: 'p1' },
      }),
    ],
    obra_participante: [
      { obra_id: 'g1', pessoa: { id: 'p1', nome: 'Bia Lima' } },
      { obra_id: 'g1', pessoa: { id: 'p2', nome: 'Caio Mendes' } },
    ],
    pessoa: [{ id: 'adm', nome: 'Ana Admin' }],
    // g1 tem config própria; g2 usa a global (rpc).
    config_avisos_obra: [{ obra_id: 'g1', pend_alta_du: 2, pend_media_du: 4, pend_baixa_du: 6 }],
  };
});

describe('loadDadosLogScore · obras gerais', () => {
  it('lê só obras gerais e devolve a parte geral sem cronograma', async () => {
    const d = await loadDadosLogScore(DESDE, 'geral');
    expect(mocks.filtros.obra).toContainEqual(['eq', 'ambiente', 'geral']);
    expect(d.obras.map((o) => o.id)).toEqual(['g1', 'g2']);
    expect(d.atividades).toEqual([]);
    expect(d.fimPrevisto).toEqual({});
    expect(d.geral!.atividades.map((a) => a.id)).toEqual(['a1', 's1', 'a2']);
    expect(d.geral!.nomes).toEqual({ adm: 'Ana Admin', p1: 'Bia Lima', p2: 'Caio Mendes' });
    expect(d.geral!.prazosPorObra).toEqual({
      g1: { alta: 2, media: 4, baixa: 6 },
      g2: { alta: 1, media: 3, baixa: 5 },
    });
    // Uma leitura só da config global, pela primeira obra sem linha própria.
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('config_avisos_da_obra', { p_obra_id: 'g2' });
    expect(itensPrestador(d)).toEqual([]);
  });

  it('sem config faltando, não lê a global', async () => {
    mocks.tabelas.config_avisos_obra = [
      { obra_id: 'g1', pend_alta_du: 2, pend_media_du: 4, pend_baixa_du: 6 },
      { obra_id: 'g2', pend_alta_du: 2, pend_media_du: 4, pend_baixa_du: 6 },
    ];
    await loadDadosLogScore(DESDE, 'geral');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('Score: atividade com responsável, tarefa e pendências com prazo da obra', async () => {
    const d = await loadDadosLogScore(DESDE, 'geral');
    const eq = itensEquipe(d);
    const porId = new Map(eq.map((i) => [i.id, i]));
    const a1 = porId.get('a1')!;
    expect(a1).toMatchObject({
      origem: 'atividade',
      chavePessoa: 'p1',
      nomePessoa: 'Bia Lima',
      prazo: '2026-10-30',
      prazoOriginal: '2026-10-28',
      // e1 e e2 (subitem) contam; e3 desfeita; e5 de atividade fora da carga.
      replanejamentos: 2,
    });
    expect(porId.has('a2')).toBe(false); // sem responsável
    // Tarefa: replanejamento pelos eventos, não pela coluna (9).
    expect(porId.get('t1')!.replanejamentos).toBe(1);
    // Alta apontada seg 02/11: g1 (2 d.u.) → qua 04/11; g2 (global, 1 d.u.) → ter 03/11.
    expect(porId.get('pd1')!.prazo).toBe('2026-11-04');
    expect(porId.get('pd2')!.prazo).toBe('2026-11-03');
    expect(calcularScoreEquipe(eq, 90, HOJE).length).toBeGreaterThan(0);
  });

  it('Log: atividade de topo sem cronograma, com de quem era e troca de responsável', async () => {
    const d = await loadDadosLogScore(DESDE, 'geral');
    const itens = itensDoLog(d);
    const a1 = itens.find((i) => i.id === 'a1')!;
    expect(a1).toMatchObject({ semCronograma: true, prazo: '2026-10-30', criadaEm: '2026-09-01' });
    expect(itens.some((i) => i.id === 's1')).toBe(false);
    const linhas = montarLog({
      itens,
      eventos: eventosDoLog(d),
      hoje: HOJE,
      formatarData: fmt,
      nomes: d.geral!.nomes,
    });
    const tipos = linhas.filter((l) => l.itemId === 'a1').map((l) => l.tipo);
    expect(tipos).toContain('responsavel_trocado');
    expect(tipos).toContain('data_desfeita');
    const concl = linhas.find((l) => l.itemId === 'a1' && l.tipo === 'concluida')!;
    expect(concl.detalhe).toContain('responsável: Bia');
  });

  it('nenhuma obra geral: vazio com a parte geral', async () => {
    mocks.tabelas.obra = [];
    const d = await loadDadosLogScore(DESDE, 'geral');
    expect(d.obras).toEqual([]);
    expect(d.geral).toEqual({ atividades: [], prazosPorObra: {}, nomes: {} });
  });

  it('lança quando uma consulta falha', async () => {
    mocks.erros = { obra_atividade: { message: 'sem rede' } };
    await expect(loadDadosLogScore(DESDE, 'geral')).rejects.toMatchObject({ message: 'sem rede' });
  });

  it('Contorno continua lendo só obras da Contorno, sem a parte geral', async () => {
    mocks.tabelas.obra = [];
    const d = await loadDadosLogScore(DESDE);
    expect(mocks.filtros.obra).toContainEqual(['eq', 'ambiente', 'contorno']);
    expect(d.geral).toBeUndefined();
  });
});
