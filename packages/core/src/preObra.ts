// Pré-obra: fases 1 (Orçamento) e 2 (Mapa de coleta) acontecem ANTES do dia 0
// (início da Mobilização) e ficam fora do % e do prazo da obra (decisão do
// usuário, 26/10/2026). As datas são calculadas para trás a partir do cronograma.
// Só aviso: nada do pré-obra trava a obra.
import { deslocarDU, type DataISO } from './calendar';
import { durSubitens, type Cronograma } from './schedule';

export interface AtividadePreObra {
  id: string;
  pai_id?: string | null;
  duracao_du: number;
  em_sequencia?: boolean;
  /** Predecessoras dentro do pré-obra (ex.: Recebimento → Quantitativos → EAP). */
  predecessoras?: string[];
  /** Mapa de coleta: as atividades da obra que ele libera. */
  mapaAlvos?: string[];
  /** Mapa: fecha até (ES da mais cedo das que libera) − antecedência. */
  mapaAntecedenciaDu?: number | null;
}

export interface DatasPreObra {
  /** Dia útil relativo ao dia 0 (pode ser negativo); ef é exclusivo. */
  es: number;
  ef: number;
  inicio_previsto: DataISO;
  fim_previsto: DataISO;
}

const ehMapa = (a: AtividadePreObra) =>
  a.mapaAntecedenciaDu !== null && a.mapaAntecedenciaDu !== undefined;

/**
 * Datas do pré-obra. Mapa: termina quando a contratação precisa estar fechada
 * (ES da mais cedo das atividades que libera − antecedência). As demais
 * (Orçamento) terminam antes do primeiro mapa, para trás pela sequência entre
 * elas. Subitens seguem dentro da atividade (sequência ou paralelo).
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
  for (const a of topo.filter(ehMapa)) {
    const ess = (a.mapaAlvos ?? [])
      .map((id) => cron.porId[id]?.es)
      .filter((x): x is number => x !== undefined);
    const ef = (ess.length ? Math.min(...ess) : 0) - (a.mapaAntecedenciaDu ?? 0);
    out[a.id] = datas(ef - dur(a), ef);
  }
  const primeiroMapa = Math.min(0, ...Object.values(out).map((d) => d.es));

  // Demais (Orçamento): o mais tarde possível antes do primeiro mapa, respeitando
  // a sequência entre elas (quem tem sucessora termina quando ela começa).
  const resto = topo.filter((a) => !ehMapa(a));
  const ids = new Set(resto.map((a) => a.id));
  const sucessoras = (id: string) =>
    resto.filter((x) => (x.predecessoras ?? []).includes(id) && ids.has(x.id));
  const pendentes = new Set(resto.map((a) => a.id));
  while (pendentes.size) {
    let avancou = false;
    for (const a of resto) {
      if (!pendentes.has(a.id)) continue;
      const suc = sucessoras(a.id);
      if (suc.some((x) => pendentes.has(x.id))) continue;
      const ef = Math.min(primeiroMapa, ...suc.map((x) => out[x.id].es));
      out[a.id] = datas(ef - dur(a), ef);
      pendentes.delete(a.id);
      avancou = true;
    }
    if (!avancou) {
      // Ciclo (não deveria acontecer): o que sobrou termina antes do primeiro mapa.
      for (const id of pendentes) {
        const a = resto.find((x) => x.id === id)!;
        out[id] = datas(primeiroMapa - dur(a), primeiroMapa);
      }
      break;
    }
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
