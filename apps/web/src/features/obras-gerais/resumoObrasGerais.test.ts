import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tabelas: {} as Record<string, unknown>,
  erros: {} as Record<string, { message: string }>,
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
  return { supabase: { from: cadeia } };
});

import { carregarResumoObrasGerais } from './resumoObrasGerais';

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
