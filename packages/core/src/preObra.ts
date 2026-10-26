// Pré-obra: fases 1 (Orçamento) e 2 (Mapa de coleta) acontecem ANTES do dia 0
// (início da Mobilização) e ficam fora do % e do prazo da obra (decisão do
// usuário, 26/10/2026). As datas são calculadas para trás a partir do cronograma.
import { deslocarDU, type DataISO } from './calendar';
import { durSubitens, type Cronograma } from './schedule';

export interface AtividadePreObra {
  id: string;
  pai_id?: string | null;
  duracao_du: number;
  em_sequencia?: boolean;
  /** Mapa de coleta: a atividade da obra que ele libera. */
  mapaAlvoId?: string | null;
  /** Mapa: contratar até ES(alvo) − antecedência. */
  mapaAntecedenciaDu?: number | null;
}

export interface DatasPreObra {
  /** Dia útil relativo ao dia 0 (pode ser negativo); ef é exclusivo. */
  es: number;
  ef: number;
  inicio_previsto: DataISO;
  fim_previsto: DataISO;
}

/**
 * Datas do pré-obra. Mapa: termina quando a contratação precisa estar fechada
 * (ES do alvo − antecedência). Atividade sem alvo (Orçamento): termina antes do
 * primeiro mapa. Subitens seguem dentro da atividade (sequência ou paralelo).
 */
export function cronogramaPreObra(
  inicio: DataISO,
  cron: Cronograma,
  atividades: AtividadePreObra[],
): Record<string, DatasPreObra> {
  const topo = atividades.filter((a) => !a.pai_id);
  const subs = (id: string) => atividades.filter((a) => a.pai_id === id);
  const dur = (a: AtividadePreObra) => {
    const s = subs(a.id);
    return s.length ? durSubitens(s) : a.duracao_du;
  };
  const datas = (es: number, ef: number): DatasPreObra => ({
    es,
    ef,
    inicio_previsto: deslocarDU(inicio, es),
    fim_previsto: deslocarDU(inicio, ef - 1),
  });

  const out: Record<string, DatasPreObra> = {};
  for (const a of topo) {
    if (!a.mapaAlvoId) continue;
    const alvo = cron.porId[a.mapaAlvoId];
    const ef = (alvo?.es ?? 0) - (a.mapaAntecedenciaDu ?? 0);
    out[a.id] = datas(ef - dur(a), ef);
  }
  const primeiroMapa = Math.min(0, ...Object.values(out).map((d) => d.es));
  for (const a of topo) {
    if (a.mapaAlvoId) continue;
    out[a.id] = datas(primeiroMapa - dur(a), primeiroMapa);
  }
  // Subitens: a partir do início da atividade, em sequência ou no início dela.
  for (const a of topo) {
    let fimAnterior = out[a.id].es;
    for (const s of subs(a.id)) {
      const es = s.em_sequencia === false ? out[a.id].es : fimAnterior;
      out[s.id] = datas(es, es + s.duracao_du);
      fimAnterior = es + s.duracao_du;
    }
  }
  return out;
}
