import type { ObraCompleta } from './detalhe';

/** O que a numeração lê: serve para a obra Contorno e para a obra geral. */
export type ObraNumeravel = {
  fases: Pick<ObraCompleta['fases'][number], 'id' | 'ordem'>[];
  atividades: Pick<ObraCompleta['atividades'][number], 'id' | 'pai_id' | 'fase_id' | 'ordem'>[];
};

/** Número de cada atividade de topo da obra (#1, #2…): fase a fase, na ordem (igual ao modelo). */
export function numeracaoObra(obra: ObraNumeravel): Map<string, number> {
  const ordemFase = new Map(obra.fases.map((f) => [f.id, f.ordem]));
  const topo = obra.atividades
    .filter((a) => !a.pai_id)
    .sort(
      (a, b) =>
        (ordemFase.get(a.fase_id) ?? 0) - (ordemFase.get(b.fase_id) ?? 0) || a.ordem - b.ordem,
    );
  return new Map(topo.map((a, i) => [a.id, i + 1]));
}

/** Reusa a numeração visível na obra; subitens e providências apontam para a atividade mãe. */
export function numerosPorVinculo(obra: ObraCompleta): Record<string, number> {
  const numeros = numeracaoObra(obra);
  const saida: Record<string, number> = {};
  for (const a of obra.atividades) {
    const numero = numeros.get(a.pai_id ?? a.id);
    if (numero == null) continue;
    saida[a.id] = numero;
    for (const p of a.providencias) saida[p.id] = numero;
  }
  return saida;
}
