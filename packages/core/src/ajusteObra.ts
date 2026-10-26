// Ajuste de prazo e dependências de uma atividade da obra (ficha · linha do
// tempo): simula o rascunho com o motor de cronograma antes de salvar.
import { addDU, duEntre, type DataISO } from './calendar';
import { calcularCronograma, type AtividadeEntrada, type Cronograma } from './schedule';

export interface RascunhoAjuste {
  id: string;
  /** Duração em dias úteis (ignorada se a atividade tiver subitens). */
  duracao_du: number;
  /** Dia útil (desde o início da obra) do início manual; null = pelo cronograma. */
  esManual: number | null;
  predecessoras: string[];
}

export interface SimulacaoAjuste {
  cronograma: Cronograma;
  /** Dia útil de início e fim (fim exclusivo) da atividade no rascunho. */
  es: number;
  ef: number;
  /** Início mais cedo possível (só pelas predecessoras). */
  esMinimo: number;
  /** Data do início manual a gravar (null = sem ajuste manual). */
  inicioManual: DataISO | null;
  entregaAntes: DataISO;
  entregaDepois: DataISO;
  /** Dias úteis que a entrega da obra anda (>0 atrasa, <0 adianta). */
  deltaEntrega: number;
}

export function simularAjuste(
  inicioObra: DataISO,
  atividades: AtividadeEntrada[],
  r: RascunhoAjuste,
): SimulacaoAjuste {
  const antes = calcularCronograma({ inicio: inicioObra, atividades });
  const montar = (manual: DataISO | null): AtividadeEntrada[] =>
    atividades.map((a) =>
      a.id === r.id
        ? { ...a, duracao_du: r.duracao_du, inicio_manual: manual, predecessoras: r.predecessoras }
        : a,
    );
  const semManual = calcularCronograma({ inicio: inicioObra, atividades: montar(null) });
  const esMinimo = semManual.porId[r.id]?.es ?? 0;
  // Início manual igual (ou antes) do mais cedo possível não é ajuste: fica pelo cronograma.
  const inicioManual =
    r.esManual !== null && r.esManual > esMinimo ? addDU(inicioObra, r.esManual) : null;
  const depois = inicioManual
    ? calcularCronograma({ inicio: inicioObra, atividades: montar(inicioManual) })
    : semManual;
  const it = depois.porId[r.id];
  return {
    cronograma: depois,
    es: it?.es ?? 0,
    ef: it?.ef ?? 0,
    esMinimo,
    inicioManual,
    entregaAntes: antes.entrega,
    entregaDepois: depois.entrega,
    deltaEntrega: depois.total - antes.total,
  };
}

/** Dia útil (desde o início da obra) de uma data; 0 para datas até o início. */
export function diaUtilDaObra(inicioObra: DataISO, data: DataISO): number {
  return duEntre(inicioObra, data);
}
