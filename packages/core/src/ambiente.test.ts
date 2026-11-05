import { describe, expect, it } from 'vitest';
import {
  ambienteInicial,
  ambientesDaPessoa,
  obrasDoAmbiente,
  podeGerirObrasGerais,
  rotuloAmbiente,
  rotuloPapelGeral,
  type AcessoPessoa,
} from './ambiente';

const acesso = (p: Partial<AcessoPessoa>): AcessoPessoa => ({
  administrador: false,
  acessoContorno: false,
  papelGeral: null,
  ...p,
});

describe('ambientesDaPessoa', () => {
  it('gestor de hoje vê só Contorno', () => {
    expect(ambientesDaPessoa(acesso({ acessoContorno: true }))).toEqual(['contorno']);
  });
  it('administrador vê os dois', () => {
    expect(ambientesDaPessoa(acesso({ administrador: true, acessoContorno: true }))).toEqual([
      'contorno',
      'geral',
    ]);
  });
  it('só Obras gerais', () => {
    expect(ambientesDaPessoa(acesso({ papelGeral: 'membro' }))).toEqual(['geral']);
  });
  it('equipe Contorno que virou Membro vê os dois', () => {
    expect(ambientesDaPessoa(acesso({ acessoContorno: true, papelGeral: 'membro' }))).toEqual([
      'contorno',
      'geral',
    ]);
  });
  it('o papel define, não as obras', () => {
    expect(ambientesDaPessoa(acesso({ papelGeral: 'coordenador' }))).toEqual(['geral']);
  });
});

describe('ambienteInicial', () => {
  it('sem último, prefere contorno', () => {
    expect(ambienteInicial(['contorno', 'geral'], null)).toBe('contorno');
  });
  it('usa o último se disponível', () => {
    expect(ambienteInicial(['contorno', 'geral'], 'geral')).toBe('geral');
  });
  it('último indisponível cai no geral', () => {
    expect(ambienteInicial(['geral'], 'contorno')).toBe('geral');
  });
  it('último indisponível cai no contorno', () => {
    expect(ambienteInicial(['contorno'], 'geral')).toBe('contorno');
  });
});

describe('obrasDoAmbiente', () => {
  it('filtra mantendo a ordem', () => {
    const obras = [
      { id: 1, ambiente: 'contorno' as const },
      { id: 2, ambiente: 'geral' as const },
      { id: 3, ambiente: 'contorno' as const },
    ];
    expect(obrasDoAmbiente(obras, 'contorno').map((o) => o.id)).toEqual([1, 3]);
    expect(obrasDoAmbiente(obras, 'geral').map((o) => o.id)).toEqual([2]);
  });
});

describe('podeGerirObrasGerais', () => {
  it('só administrador', () => {
    expect(podeGerirObrasGerais(acesso({ administrador: true }))).toBe(true);
    expect(podeGerirObrasGerais(acesso({ acessoContorno: true, papelGeral: 'coordenador' }))).toBe(false);
  });
});

describe('rótulos', () => {
  it('ambiente e papel', () => {
    expect(rotuloAmbiente('contorno')).toBe('Contorno');
    expect(rotuloAmbiente('geral')).toBe('Obras gerais');
    expect(rotuloPapelGeral('coordenador')).toBe('Coordenador');
    expect(rotuloPapelGeral('membro')).toBe('Membro');
  });
});
