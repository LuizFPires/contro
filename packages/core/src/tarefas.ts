// Tarefas (SPEC §3.6/§5). Classificação (atrasadas/abertas/concluídas) e o texto
// de replanejamento. A formatação de data fica na UI; aqui recebemos já formatado.
import type { DataISO } from './calendar';

export type StatusTarefa = 'aberta' | 'feita';

export interface Tarefa {
  id: string;
  status: StatusTarefa;
  prazo: DataISO;
  prazo_original: DataISO | null;
  replanejamentos: number;
}

/** Atrasada = aberta e com o prazo já vencido (datas ISO comparam lexicograficamente). */
export function tarefaAtrasada(t: Pick<Tarefa, 'status' | 'prazo'>, hoje: DataISO): boolean {
  return t.status === 'aberta' && t.prazo < hoje;
}

export interface TarefasClassificadas<T extends Tarefa> {
  atrasadas: T[]; // abertas vencidas, por prazo
  abertas: T[]; // abertas no prazo, por prazo
  concluidas: T[];
}

export function classificarTarefas<T extends Tarefa>(
  tarefas: T[],
  hoje: DataISO,
): TarefasClassificadas<T> {
  const atrasadas: T[] = [];
  const abertas: T[] = [];
  const concluidas: T[] = [];
  for (const t of tarefas) {
    if (t.status === 'feita') concluidas.push(t);
    else if (tarefaAtrasada(t, hoje)) atrasadas.push(t);
    else abertas.push(t);
  }
  const porPrazo = (a: T, b: T) => a.prazo.localeCompare(b.prazo);
  atrasadas.sort(porPrazo);
  abertas.sort(porPrazo);
  return { atrasadas, abertas, concluidas };
}

/**
 * "Replanejada Nx · prazo original <data>" (SPEC aceite M6). Recebe a data já
 * formatada pela UI; retorna null quando a tarefa nunca foi replanejada.
 */
export function textoReplanejamento(
  replanejamentos: number,
  prazoOriginalFmt: string | null,
): string | null {
  if (replanejamentos <= 0) return null;
  const nx = `Replanejada ${replanejamentos}x`;
  return prazoOriginalFmt ? `${nx} · prazo original ${prazoOriginalFmt}` : nx;
}
