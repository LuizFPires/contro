// Pauta guiada da reunião (opção A): "Não feito" → providência para recuperar,
// com o impacto no cronograma só simulado (nada é gravado no cronograma).
import { addDU, duEntre, type DataISO } from './calendar';
import { simularAjuste } from './ajusteObra';
import { calcularCronograma, type AtividadeEntrada } from './schedule';

export interface ImpactoConclusao {
  fimAntes: DataISO;
  fimDepois: DataISO;
  entregaAntes: DataISO;
  entregaDepois: DataISO;
  /** Dias úteis que a entrega anda (>0 atrasa). */
  deltaEntrega: number;
}

/**
 * Simula a atividade terminando em `data` (estende a duração; mantém início e
 * predecessoras). Devolve null para atividade com subitens (prazo derivado) ou
 * inexistente.
 */
export function simularConclusaoEm(
  inicioObra: DataISO,
  atividades: AtividadeEntrada[],
  id: string,
  data: DataISO,
): ImpactoConclusao | null {
  const a = atividades.find((x) => x.id === id);
  if (!a || atividades.some((x) => x.pai_id === id)) return null;
  const antes = calcularCronograma({ inicio: inicioObra, atividades }).porId[id];
  if (!antes) return null;
  const efNovo = duEntre(inicioObra, data) + 1;
  const duracao = Math.max(a.duracao_du, efNovo - antes.es);
  const sim = simularAjuste(inicioObra, atividades, {
    id,
    duracao_du: duracao,
    esManual: a.inicio_manual ? duEntre(inicioObra, a.inicio_manual) : null,
    predecessoras: a.predecessoras ?? [],
  });
  return {
    fimAntes: antes.fim_previsto,
    fimDepois: addDU(inicioObra, sim.ef - 1),
    entregaAntes: sim.entregaAntes,
    entregaDepois: sim.entregaDepois,
    deltaEntrega: sim.deltaEntrega,
  };
}

/** Próximos `n` dias úteis depois de `hoje` (chips de data da providência). */
export function datasProvidencia(hoje: DataISO, n = 5): DataISO[] {
  return Array.from({ length: n }, (_, i) => addDU(hoje, i + 1));
}

/** Segunda da reunião seguinte (as reuniões são semanais, às segundas). */
export function proximaReuniao(dataReuniao: DataISO): DataISO {
  return addDU(dataReuniao, 5);
}

/** A providência vence na semana da próxima reunião ou depois. */
export function voltaNaProximaReuniao(dataReuniao: DataISO, prazo: DataISO): boolean {
  return prazo >= proximaReuniao(dataReuniao);
}

/** Aviso do formulário: para onde a providência vai depois de salva. */
export function avisoProvidencia(a: {
  responsavel: string | null;
  prazoFmt: string;
  proximaFmt: string;
  volta: boolean;
}): string {
  const quem = a.responsavel ? `nas Tarefas de ${a.responsavel}` : 'nas Tarefas (sem responsável)';
  return a.volta
    ? `Entra ${quem} e volta na reunião de ${a.proximaFmt}, em "Providências da reunião anterior".`
    : `Entra ${quem} até ${a.prazoFmt}. Na reunião de ${a.proximaFmt} aparece para conferir se foi feita.`;
}
