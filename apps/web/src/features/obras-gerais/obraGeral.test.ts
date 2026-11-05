import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ tabelas: {} as Record<string, unknown> }));

/** Cadeia do query builder: cada filtro devolve a própria cadeia; await e maybeSingle resolvem. */
vi.mock('../../lib/supabase', () => {
  const cadeia = (tabela: string) => {
    const resultado = () => ({ data: mocks.tabelas[tabela] ?? null, error: null });
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'order']) c[m] = () => c;
    c.maybeSingle = () => Promise.resolve(resultado());
    c.then = (ok: (r: unknown) => unknown) => Promise.resolve(resultado()).then(ok);
    return c;
  };
  return { supabase: { from: cadeia } };
});

import type { ObraCompleta } from '../obras/detalhe';
import type { ObraConclusao } from '../obras/useConcluirAtividade';
import { carregarObraGeral, type ObraGeral } from './obraGeral';

// Checagem de tipos: as duas obras servem a useConcluirAtividade e useAvanco.
export const _servemNosHooks = (a: ObraCompleta, b: ObraGeral): ObraConclusao[] => [a, b];

beforeEach(() => {
  mocks.tabelas = {
    obra: { id: 'o1', nome: 'Matriz', cidade: 'Rio' },
    obra_fase: [{ id: 'f1', ordem: 1, titulo: 'Estrutura' }],
    obra_atividade: [],
    obra_participante: [
      { pessoa: { id: 'p1', nome: 'Bia', papel_geral: 'coordenador' } },
      { pessoa: { id: 'p2', nome: 'Caio', papel_geral: 'membro' } },
      { pessoa: { id: 'a1', nome: 'Ana', papel_geral: 'coordenador' } },
    ],
    pessoa: [
      { id: 'a1', nome: 'Ana' },
      { id: 'a2', nome: 'Davi' },
    ],
    obra_providencia: [],
  };
});

describe('carregarObraGeral', () => {
  it('junta participantes e Administradores sem repetir', async () => {
    const o = await carregarObraGeral('o1');
    expect(o?.pessoas.map((p) => p.id).sort()).toEqual(['a1', 'a2', 'p1', 'p2']);
  });

  it('Administrador que também participa sai como administrador', async () => {
    const o = await carregarObraGeral('o1');
    expect(o?.pessoas.find((p) => p.id === 'a1')?.papel).toBe('administrador');
    expect(o?.pessoas.find((p) => p.id === 'p1')?.papel).toBe('coordenador');
    expect(o?.pessoas.find((p) => p.id === 'p2')?.papel).toBe('membro');
  });

  it('marca as fases como não preliminares', async () => {
    const o = await carregarObraGeral('o1');
    expect(o?.fases).toEqual([{ id: 'f1', ordem: 1, titulo: 'Estrutura', preliminar: false }]);
  });

  it('obra inexistente devolve null', async () => {
    mocks.tabelas.obra = null;
    expect(await carregarObraGeral('x')).toBeNull();
  });
});
