import { describe, expect, it } from 'vitest';
import { normalizarTextoProvidencia, textoProvidencia } from './textoProvidencia';

describe('texto de providência', () => {
  it.each([
    ['compra', 'Cimento e areia', 'Comprar Cimento e areia'],
    ['locacao', 'Betoneira', 'Alugar Betoneira'],
    ['contratacao', 'Pintor', 'Contratar Pintor'],
  ])('usa verbo sem dois-pontos para %s', (tipo, descricao, esperado) => {
    expect(textoProvidencia(tipo, descricao)).toBe(esperado);
  });

  it.each([
    ['Compra: Cimento e areia', 'Comprar Cimento e areia'],
    ['Comprar: Cimento, areia e brita', 'Comprar Cimento, areia e brita'],
    ['Locação: Betoneira', 'Alugar Betoneira'],
    ['Alugar: Serra clipper', 'Alugar Serra clipper'],
    ['Contratação: Pintor', 'Contratar Pintor'],
    ['Contratar: Eletricista', 'Contratar Eletricista'],
    ['Destravar Compra: Porcelanato', 'Comprar Porcelanato'],
    ['  COMPRA :  Tinta: branca  ', 'Comprar Tinta: branca'],
    ['Locacao: Andaime', 'Alugar Andaime'],
    ['Contratacao: Equipe', 'Contratar Equipe'],
  ])('converte título salvo %s sem alterar a descrição', (antigo, esperado) => {
    expect(normalizarTextoProvidencia(antigo)).toBe(esperado);
    expect(normalizarTextoProvidencia(esperado)).toBe(esperado);
  });

  it.each([
    'Comprar cimento',
    'Conferir compra: cimento',
    'Compra de materiais já aprovada',
    'Revisar contrato de locação',
    'Compra:   ',
    '',
  ])('preserva texto livre ou já padronizado: %s', (texto) => {
    expect(normalizarTextoProvidencia(texto)).toBe(texto);
  });
});
