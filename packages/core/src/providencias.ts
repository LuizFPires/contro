// Lembretes de providência (SPEC 4.4). Sem valor e sem fornecedor (decisão do
// produto). O limite é relativo ao início da atividade (ES) e à antecedência.
import { addDU, type DataISO } from './calendar';

/** Dia (em du, relativo ao início da obra) até quando a providência deve estar pronta. */
export function limiteProvidencia(esAtividade: number, antecedenciaDu: number): number {
  return esAtividade - antecedenciaDu;
}

/** Data (ISO) até quando providenciar. */
export function providenciarAte(
  inicio: DataISO,
  esAtividade: number,
  antecedenciaDu: number,
): DataISO {
  return addDU(inicio, Math.max(limiteProvidencia(esAtividade, antecedenciaDu), 0));
}

/** Quando precisa estar na obra: override, senão o início previsto da atividade. */
export function naObraEm(inicio: DataISO, esAtividade: number, override?: DataISO | null): DataISO {
  return override ?? addDU(inicio, esAtividade);
}

export interface ProvidenciaAtrasadaArgs {
  status: 'pendente' | 'feito';
  atividadeConcluida: boolean;
  obraIniciada: boolean;
  decorridos: number;
  esAtividade: number;
  antecedenciaDu: number;
}

/**
 * Providência atrasada: pendente, atividade não concluída, obra iniciada e o dia
 * limite já passou ("providenciar até sex" ainda vale na sexta).
 */
export function providenciaAtrasada(a: ProvidenciaAtrasadaArgs): boolean {
  return (
    a.status === 'pendente' &&
    !a.atividadeConcluida &&
    a.obraIniciada &&
    a.decorridos > Math.max(limiteProvidencia(a.esAtividade, a.antecedenciaDu), 0)
  );
}
