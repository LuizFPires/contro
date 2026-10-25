// Indicadores da obra (SPEC §4.5). As FÓRMULAS (real, previsto_hoje/sexta,
// ritmo_dias) vivem em `obra.ts` (estadoObra) com `peso()` isolado (Q2). Aqui
// ficam os helpers de TEXTO/classificação do ritmo e da inauguração, para a UI
// e o PDF não recalcularem (regra 1).

/** Atrasada pelo ritmo: ≤ −2 dias (exceção aprovada do vermelho). */
export function estaAtrasada(ritmoDias: number): boolean {
  return ritmoDias <= -2;
}

export interface RitmoTexto {
  texto: string;
  atrasada: boolean;
}

/**
 * Texto do ritmo (SPEC §4.5): ≥ +1 "N dias à frente do modelo"; −1..0
 * "No ritmo do modelo"; ≤ −2 "Atrasada · N dias". `curto` omite "do modelo".
 */
export function ritmoTexto(ritmoDias: number, curto = false): RitmoTexto {
  const suf = curto ? '' : ' do modelo';
  if (ritmoDias >= 1) {
    return { texto: `${ritmoDias} ${ritmoDias === 1 ? 'dia' : 'dias'} à frente${suf}`, atrasada: false };
  }
  if (estaAtrasada(ritmoDias)) {
    return { texto: `Atrasada · ${Math.abs(ritmoDias)} dias`, atrasada: true };
  }
  return { texto: `No ritmo${suf}`, atrasada: false };
}

/** Dias úteis que faltam para a entrega (para a tarja de Inauguração). */
export function diasUteisRestantes(decorridos: number, total: number): number {
  return Math.max(total - decorridos, 0);
}
