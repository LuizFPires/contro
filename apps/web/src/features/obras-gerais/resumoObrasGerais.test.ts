import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tabelas: {} as Record<string, unknown>,
  erros: {} as Record<string, { message: string }>,
  rpc: vi.fn(),
}));

vi.mock('../../lib/supabase', () => {
  const cadeia = (tabela: string) => {
    const resultado = () => ({
      data: mocks.tabelas[tabela] ?? null,
      error: mocks.erros[tabela] ?? null,
    });
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'order']) c[m] = () => c;
    c.then = (ok: (r: unknown) => unknown) => Promise.resolve(resultado()).then(ok);
    return c;
  };
  return { supabase: { from: cadeia, rpc: mocks.rpc } };
});

import type { PendenciaObra } from '../obras/pendenciasObra';
import { acoesDaTelaGeral, carregarResumoObrasGerais } from './resumoObrasGerais';

const HOJE = '2026-11-05'; // quinta

function ativ(o: Record<string, unknown>) {
  return {
    fase_id: 'f',
    pai_id: null,
    ordem: 1,
    data_prevista: null,
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

beforeEach(() => {
  mocks.erros = {};
  mocks.rpc.mockReset();
  mocks.rpc.mockResolvedValue({
    data: { pend_alta_du: 2, pend_media_du: 4, pend_baixa_du: 6 },
    error: null,
  });
  mocks.tabelas = {
    obra: [
      { id: 'o1', nome: 'Matriz', cidade: 'Rio' },
      { id: 'o2', nome: 'Filial', cidade: null },
    ],
    obra_atividade: [
      ativ({
        id: 'a1',
        obra_id: 'o1',
        nome: 'Pintura',
        data_prevista: '2026-11-03',
        responsavel_id: 'p1',
      }),
      ativ({ id: 'a2', obra_id: 'o1', nome: 'Piso', data_prevista: HOJE, responsavel_id: 'a1' }),
      ativ({ id: 'a3', obra_id: 'o2', nome: 'Forro', data_prevista: '2026-11-20' }),
    ],
    obra_participante: [
      { obra_id: 'o1', pessoa: { id: 'p1', nome: 'Bia', ativo: true, deleted_at: null } },
      { obra_id: 'o1', pessoa: { id: 'p2', nome: 'Caio', ativo: false, deleted_at: null } },
      { obra_id: 'o2', pessoa: { id: 'p1', nome: 'Bia', ativo: true, deleted_at: null } },
    ],
    pessoa: [{ id: 'a1', nome: 'Ana' }],
    tarefa: [],
    pendencia: [],
    obra_providencia: [],
    config_avisos_obra: [],
  };
});

describe('carregarResumoObrasGerais', () => {
  it('monta o resumo de cada obra com agenda, ações, eficiência e pessoas', async () => {
    const r = await carregarResumoObrasGerais(
      { id: 'p9', administrador: false, papelGeral: 'coordenador' },
      HOJE,
    );
    expect(r.map((o) => o.nome)).toEqual(['Matriz', 'Filial']);
    const m = r[0]!;
    expect(m.papel).toBe('coordenador');
    expect(m.pessoas).toBe(1);
    expect(m.agenda.atrasados.map((i) => [i.nome, i.pessoa])).toEqual([['Pintura', 'Bia']]);
    expect(m.agenda.hoje.map((i) => [i.nome, i.pessoa])).toEqual([['Piso', 'Ana']]);
    expect(m.acoes).toHaveLength(2);
    expect(m.eficiencia).toEqual({ noPrazo: 0, total: 1, pct: 0 });
    const f = r[1]!;
    expect(f.agenda).toEqual({ atrasados: [], hoje: [] });
    expect(f.acoes).toHaveLength(1);
    expect(f.eficiencia.pct).toBeNull();
  });

  it('Administrador tem papel administrador e "Você" na própria atividade', async () => {
    const r = await carregarResumoObrasGerais(
      { id: 'a1', administrador: true, papelGeral: null },
      HOJE,
    );
    expect(r[0]!.papel).toBe('administrador');
    expect(r[0]!.agenda.hoje[0]!.pessoa).toBe('Você');
  });

  it('lança quando uma consulta falha', async () => {
    mocks.erros = { obra_atividade: { message: 'sem rede' } };
    await expect(
      carregarResumoObrasGerais({ id: 'p1', administrador: false, papelGeral: 'membro' }, HOJE),
    ).rejects.toThrow('sem rede');
  });
});

function tarefaLinha(o: Record<string, unknown>) {
  return {
    texto: 'Tarefa',
    responsavel_id: null,
    prazo: HOJE,
    prazo_original: null,
    replanejamentos: 0,
    status: 'aberta',
    vinculo_tipo: null,
    vinculo_id: null,
    origem_texto: null,
    observacao: null,
    responsavel_nome: null,
    avanco_pct: 0,
    comentario: null,
    avanco_em: null,
    feita_em: null,
    responsavel: null,
    ...o,
  };
}

describe('carregarResumoObrasGerais · ações completas', () => {
  beforeEach(() => {
    mocks.tabelas.tarefa = [
      // Vinculada à Piso (a2): a tarefa a representa, a atividade sai.
      tarefaLinha({
        id: 't1',
        obra_id: 'o1',
        texto: 'Atividade: Piso',
        responsavel_id: 'p1',
        prazo: '2026-11-04',
        vinculo_tipo: 'atividade',
        vinculo_id: 'a2',
        responsavel: { nome: 'Bia' },
      }),
    ];
    mocks.tabelas.pendencia = [
      {
        id: 'pe1',
        obra_id: 'o1',
        titulo: 'Rodapé',
        criticidade: 'alta',
        status: 'aberta',
        apontada_em: '2026-11-04T12:00:00',
        resolvida_em: null,
        responsavel_id: null,
      },
    ];
    mocks.tabelas.obra_providencia = [
      {
        id: 'pv1',
        obra_id: 'o2',
        atividade_id: 'a3',
        tipo: 'compra',
        descricao: 'Placas',
        status: 'pendente',
        providenciar_ate: HOJE,
      },
    ];
    // A Matriz tem prazos próprios (alta = 1); a Filial usa a config global.
    mocks.tabelas.config_avisos_obra = [
      { obra_id: 'o1', pend_alta_du: 1, pend_media_du: 4, pend_baixa_du: 6 },
    ];
  });

  it('inclui tarefas, pendências e providências, sem repetir a atividade com tarefa', async () => {
    const r = await carregarResumoObrasGerais(
      { id: 'p9', administrador: false, papelGeral: 'coordenador' },
      HOJE,
    );
    const m = r[0]!;
    expect(m.acoes.map((a) => `${a.origem}:${a.id}:${a.prazo}`)).toEqual([
      'atividade:a1:2026-11-03',
      'tarefa:t1:2026-11-04',
      'pendencia:pe1:2026-11-05',
    ]);
    expect(m.agenda.atrasados.map((i) => i.chave)).toEqual(['geral:a1', 'tarefa:t1']);
    expect(m.agenda.hoje.map((i) => [i.chave, i.pessoa])).toEqual([
      ['pendencia:pe1', 'Sem responsável'],
    ]);
    const f = r[1]!;
    expect(f.prazosPendencia).toEqual({ alta: 2, media: 4, baixa: 6 });
    expect(f.agenda.hoje.map((i) => i.nome)).toEqual(['Comprar Placas']);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('config_avisos_da_obra', { p_obra_id: 'o2' });
  });

  it('a tela de ações usa as tarefas e pendências do cache, com o original de cada uma', async () => {
    const r = await carregarResumoObrasGerais(
      { id: 'p9', administrador: false, papelGeral: 'coordenador' },
      HOJE,
    );
    const o2 = r[1]!;
    const pendencia = {
      id: 'pe9',
      obra_id: 'o2',
      titulo: 'Trinca',
      criticidade: 'media',
      status: 'aberta',
      apontada_em: '2026-11-05T12:00:00',
      resolvida_em: null,
      responsavel_id: 'p1',
      responsavelNome: 'Bia',
    } as unknown as PendenciaObra;
    const lista = acoesDaTelaGeral(o2, [], [pendencia]);
    expect(lista.map((a) => `${a.origem}:${a.id}`)).toEqual([
      'atividade:a3',
      'pendencia:pe9',
      'providencia:pv1',
    ]);
    const prov = lista[2]!;
    expect(prov.origem === 'providencia' && prov.providencia.atividadeNome).toBe('Forro');
    expect(prov.atividadeId).toBe('a3');
    const pend = lista[1]!;
    expect(pend.origem === 'pendencia' && pend.pendencia).toBe(pendencia);
    expect(pend.prazo).toBe('2026-11-11');
  });
});
