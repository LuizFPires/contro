import { describe, expect, it } from 'vitest';
import { podeDesligarNaContorno, rotuloPapelContorno, type AlvoDesligar } from './papelContorno';

const gestor = { id: 'g', perfil: 'gestor' as const, coordenadorContorno: false };
const coord = { id: 'c', perfil: 'gestor' as const, coordenadorContorno: true };
const equipe = { id: 'e', perfil: 'equipe' as const, coordenadorContorno: false };
const alvo = (p: Partial<AlvoDesligar>): AlvoDesligar => ({
  id: 'x',
  perfil: 'equipe',
  coordenadorContorno: false,
  administrador: false,
  papelGeral: null,
  ...p,
});

describe('rotuloPapelContorno', () => {
  it('Gestor, Coordenador e Equipe de obra', () => {
    expect(rotuloPapelContorno(gestor)).toBe('Gestor');
    expect(rotuloPapelContorno(coord)).toBe('Coordenador');
    expect(rotuloPapelContorno(equipe)).toBe('Equipe de obra');
  });
});

describe('podeDesligarNaContorno', () => {
  it('Gestor desliga qualquer um, menos a si mesmo', () => {
    expect(podeDesligarNaContorno(gestor, alvo({}))).toBe(true);
    expect(podeDesligarNaContorno(gestor, alvo({ perfil: 'gestor' }))).toBe(true);
    expect(
      podeDesligarNaContorno(gestor, alvo({ perfil: 'gestor', coordenadorContorno: true })),
    ).toBe(true);
    expect(podeDesligarNaContorno(gestor, alvo({ id: 'g', perfil: 'gestor' }))).toBe(false);
  });

  it('Coordenador só desliga quem é da Equipe', () => {
    expect(podeDesligarNaContorno(coord, alvo({}))).toBe(true);
    expect(podeDesligarNaContorno(coord, alvo({ perfil: 'gestor' }))).toBe(false);
    expect(
      podeDesligarNaContorno(coord, alvo({ perfil: 'gestor', coordenadorContorno: true })),
    ).toBe(false);
    expect(podeDesligarNaContorno(coord, alvo({ administrador: true }))).toBe(false);
    expect(podeDesligarNaContorno(coord, alvo({ papelGeral: 'coordenador' }))).toBe(false);
    expect(podeDesligarNaContorno(coord, alvo({ papelGeral: 'membro' }))).toBe(true);
  });

  it('Equipe não desliga ninguém', () => {
    expect(podeDesligarNaContorno(equipe, alvo({}))).toBe(false);
  });
});
