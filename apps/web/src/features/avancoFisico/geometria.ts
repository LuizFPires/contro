import type { CurvaAvanco } from '@contro/core';

/** Geometria do gráfico (viewBox 320 × 132), igual na tela e no PDF. */
export function geometriaCurva(c: CurvaAvanco) {
  const X0 = 8;
  const X1 = 312;
  const Y0 = 110;
  const Y1 = 22;
  const xmax = Math.max(c.planoFim, c.fim ?? 0, c.pontos[c.pontos.length - 1].du) + 0.6;
  const X = (i: number) => X0 + ((X1 - X0) * i) / xmax;
  const Y = (q: number) => Y0 - ((Y0 - Y1) * q) / Math.max(1e-9, c.total);
  const pts = c.pontos.map((p) => [X(p.du), Y(p.acumulado)] as const);
  const ultimo = pts[pts.length - 1];
  return {
    X,
    Y,
    X0,
    X1,
    Y0,
    plano: [
      [X(c.planoIni), Y0],
      [X(c.planoFim), Y(c.total)],
    ] as const,
    real: pts,
    ultimo,
    projecao: c.fim !== null ? ([ultimo, [X(c.fim), Y(c.total)]] as const) : null,
    xPrazo: X(c.planoFim),
    yTotal: Y(c.total),
  };
}
