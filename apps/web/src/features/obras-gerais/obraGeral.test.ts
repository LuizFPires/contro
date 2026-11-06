import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tabelas: {} as Record<string, unknown>,
  erros: {} as Record<string, { message: string }>,
}));

/** Cadeia do query builder: cada filtro devolve a própria cadeia; await e maybeSingle resolvem. */
vi.mock('../../lib/supabase', () => {
  const cadeia = (tabela: string) => {
    const resultado = () => ({
      data: mocks.tabelas[tabela] ?? null,
      error: mocks.erros[tabela] ?? null,
    });
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
      {
        pessoa: {
          id: 'p1',
          nome: 'Bia',
          papel_geral: 'coordenador',
          ativo: true,
          deleted_at: null,
        },
      },
      { pessoa: { id: 'p2', nome: 'Caio', papel_geral: 'membro', ativo: true, deleted_at: null } },
      {
        pessoa: {
          id: 'a1',
          nome: 'Ana',
          papel_geral: 'coordenador',
          ativo: true,
          deleted_at: null,
        },
      },
    ],
    pessoa: [
      { id: 'a1', nome: 'Ana' },
      { id: 'a2', nome: 'Davi' },
    ],
    obra_providencia: [],
  };
  mocks.erros = {};
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

  it('distingue quem participa do Administrador que só vê', async () => {
    const o = await carregarObraGeral('o1');
    const participa = (id: string) => o?.pessoas.find((p) => p.id === id)?.participa;
    expect(participa('a1')).toBe(true);
    expect(participa('a2')).toBe(false);
    expect(participa('p2')).toBe(true);
  });

  it('marca as fases como não preliminares', async () => {
    const o = await carregarObraGeral('o1');
    expect(o?.fases).toEqual([{ id: 'f1', ordem: 1, titulo: 'Estrutura', preliminar: false }]);
  });

  it('deixa de fora participante desativado ou apagado', async () => {
    mocks.tabelas.obra_participante = [
      {
        pessoa: {
          id: 'p1',
          nome: 'Bia',
          papel_geral: 'coordenador',
          ativo: true,
          deleted_at: null,
        },
      },
      { pessoa: { id: 'p3', nome: 'Edu', papel_geral: 'membro', ativo: false, deleted_at: null } },
      {
        pessoa: {
          id: 'p4',
          nome: 'Fabi',
          papel_geral: 'membro',
          ativo: true,
          deleted_at: '2026-11-01T00:00:00Z',
        },
      },
    ];
    const o = await carregarObraGeral('o1');
    expect(o?.pessoas.map((p) => p.id).sort()).toEqual(['a1', 'a2', 'p1']);
  });

  it('erro de consulta lança em vez de devolver null', async () => {
    mocks.erros.obra_atividade = { message: 'Failed to fetch' };
    await expect(carregarObraGeral('o1')).rejects.toThrow('Failed to fetch');
  });

  it('obra inexistente devolve null', async () => {
    mocks.tabelas.obra = null;
    expect(await carregarObraGeral('x')).toBeNull();
  });
});
