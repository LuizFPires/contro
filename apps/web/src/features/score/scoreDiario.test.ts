import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: null }));

import { argsGravarScore, gravaScoreDiario, type LinhaGravar } from './scoreDiario';

const linhas: LinhaGravar[] = [
  { aba: 'equipe', chave: 'p1', nome: 'Bia Lima', score30: 80, score90: 75 },
];

describe('gravaScoreDiario', () => {
  it('Contorno: todos gravam', () => {
    expect(gravaScoreDiario('contorno', false)).toBe(true);
    expect(gravaScoreDiario('contorno', true)).toBe(true);
  });

  it('Obras gerais: só o Administrador grava', () => {
    expect(gravaScoreDiario('geral', true)).toBe(true);
    expect(gravaScoreDiario('geral', false)).toBe(false);
  });
});

describe('argsGravarScore', () => {
  it('Contorno: os argumentos de sempre, sem o ambiente', () => {
    expect(argsGravarScore(linhas, 'contorno')).toEqual({ p_linhas: linhas });
  });

  it('Obras gerais: passa o ambiente', () => {
    expect(argsGravarScore(linhas, 'geral')).toEqual({ p_linhas: linhas, p_ambiente: 'geral' });
  });
});
