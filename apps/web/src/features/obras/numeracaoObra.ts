import type { ObraCompleta } from './detalhe';

/** Número de cada atividade de topo da obra (#1, #2…): fase a fase, na ordem (igual ao modelo). */
export function numeracaoObra(obra: ObraCompleta): Map<string, number> {
  const ordemFase = new Map(obra.fases.map((f) => [f.id, f.ordem]));
  const topo = obra.atividades
    .filter((a) => !a.pai_id)
    .sort(
      (a, b) =>
        (ordemFase.get(a.fase_id) ?? 0) - (ordemFase.get(b.fase_id) ?? 0) || a.ordem - b.ordem,
    );
  return new Map(topo.map((a, i) => [a.id, i + 1]));
}
