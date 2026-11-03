import { expect, it } from 'vitest';
import { nomePrestadorExistente, normalizarPrestador } from './nomesPrestador';
it('reutiliza nomes ignorando acentos, caixa e espaços', () => {
  expect(nomePrestadorExistente('  joao   SILVA ', ['João Silva'])).toBe('João Silva');
  expect(normalizarPrestador('JOÃO')).toBe(normalizarPrestador('Joao'));
  expect(nomePrestadorExistente('Maria', ['Mariana'])).toBe('Maria');
});
