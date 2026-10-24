import { describe, it, expect } from 'vitest';
import { podeEditarModelos, rotuloPerfil } from './index';

describe('perfil', () => {
  it('só o gestor edita modelos', () => {
    expect(podeEditarModelos('gestor')).toBe(true);
    expect(podeEditarModelos('equipe')).toBe(false);
  });

  it('rótulos em pt-BR', () => {
    expect(rotuloPerfil('gestor')).toBe('Gestor');
    expect(rotuloPerfil('equipe')).toBe('Equipe de obra');
  });
});
