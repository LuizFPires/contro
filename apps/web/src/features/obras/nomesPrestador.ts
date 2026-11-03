export const normalizarPrestador = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');

export function nomePrestadorExistente(texto: string, nomes: string[]): string {
  return (
    nomes.find((n) => normalizarPrestador(n) === normalizarPrestador(texto)) ??
    texto.trim().replace(/\s+/g, ' ')
  );
}
