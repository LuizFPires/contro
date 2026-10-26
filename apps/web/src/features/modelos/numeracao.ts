import type { ModeloCompleto } from './detalhe';

/** Número de cada atividade de topo no modelo (#1, #2…): fase a fase, na ordem. */
export function numeracao(modelo: ModeloCompleto): Map<string, number> {
  const ordemFase = new Map(modelo.fases.map((f) => [f.id, f.ordem]));
  const topo = modelo.atividades
    .filter((a) => !a.pai_id)
    .sort(
      (a, b) =>
        (ordemFase.get(a.fase_id) ?? 0) - (ordemFase.get(b.fase_id) ?? 0) || a.ordem - b.ordem,
    );
  return new Map(topo.map((a, i) => [a.id, i + 1]));
}
