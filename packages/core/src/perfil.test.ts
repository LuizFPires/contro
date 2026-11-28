import { describe, it, expect } from 'vitest';
import { podeApagarObra, podeConcluirObra, podeEditarModelos, rotuloPerfil } from './index';

describe('perfil', () => {
  it('só o gestor edita modelos', () => {
    expect(podeEditarModelos('gestor')).toBe(true);
    expect(podeEditarModelos('equipe')).toBe(false);
  });

  it('só o gestor apaga obra', () => {
    expect(podeApagarObra('gestor')).toBe(true);
    expect(podeApagarObra('equipe')).toBe(false);
  });

  it('gestor e coordenador (perfil gestor) concluem obra; a equipe não', () => {
    expect(podeConcluirObra('gestor')).toBe(true);
    expect(podeConcluirObra('equipe')).toBe(false);
  });

  it('rótulos em pt-BR', () => {
    expect(rotuloPerfil('gestor')).toBe('Gestor');
    expect(rotuloPerfil('equipe')).toBe('Equipe de obra');
  });
});
