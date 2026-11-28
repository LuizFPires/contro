// Mudar o início da obra (28/11/2026): a obra inteira anda junto. O cronograma
// já é relativo ao início; as datas gravadas à mão (início manual da atividade e
// "na obra em" da providência) andam o mesmo número de dias úteis.
import { deslocarDU, diaUtilAPartir, duEntre, type DataISO } from './calendar';
import { calcularCronograma, type AtividadeEntrada } from './schedule';

/** Dias úteis entre dois inícios, com sinal (>0 = a obra vai para depois). */
export function deltaInicioDU(antes: DataISO, depois: DataISO): number {
  return depois >= antes ? duEntre(antes, depois) : -duEntre(depois, antes);
}

export interface MudancaInicioObra {
  /** Novo início (sempre dia útil). */
  inicio: DataISO;
  deltaDu: number;
  atividades: { id: string; inicio_manual: DataISO }[];
  providencias: { id: string; na_obra_em: DataISO }[];
  entregaAntes: DataISO;
  entregaDepois: DataISO;
}

/**
 * Calcula o que muda ao trocar o início da obra: novo início (dia útil), as
 * datas manuais deslocadas e a inauguração antes e depois.
 */
export function mudarInicioObra(
  inicioAntes: DataISO,
  inicioEscolhido: DataISO,
  atividades: AtividadeEntrada[],
  providencias: { id: string; na_obra_em: DataISO | null }[],
): MudancaInicioObra {
  const inicio = diaUtilAPartir(inicioEscolhido);
  const deltaDu = deltaInicioDU(inicioAntes, inicio);
  const mover = (d: DataISO) => deslocarDU(diaUtilAPartir(d), deltaDu);
  const novas = atividades
    .filter((a) => a.inicio_manual)
    .map((a) => ({ id: a.id, inicio_manual: mover(a.inicio_manual as DataISO) }));
  const porId = new Map(novas.map((n) => [n.id, n.inicio_manual]));
  const depois = atividades.map((a) =>
    porId.has(a.id) ? { ...a, inicio_manual: porId.get(a.id) } : a,
  );
  return {
    inicio,
    deltaDu,
    atividades: novas,
    providencias: providencias
      .filter((p) => p.na_obra_em)
      .map((p) => ({ id: p.id, na_obra_em: mover(p.na_obra_em as DataISO) })),
    entregaAntes: calcularCronograma({ inicio: inicioAntes, atividades }).entrega,
    entregaDepois: calcularCronograma({ inicio, atividades: depois }).entrega,
  };
}
