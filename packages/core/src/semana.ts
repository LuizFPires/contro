// Semana da obra (SPEC §4.6). Tudo relativo a `decorridos` (dias úteis desde o
// início). A semana corrente é [decorridos, decorridos+5); a passada é
// [decorridos−5, decorridos). Puro e testado (regra 1).
import { limiteProvidencia, providenciaAtrasada } from './providencias';

export interface AtividadeSemana {
  id: string;
  es: number; // early start (du)
  ef: number; // early finish (du)
  concluida: boolean;
  liberada: boolean;
}

/** Deve concluir nesta semana: não concluída, fim previsto cai na janela. */
export function concluirNaSemana(a: AtividadeSemana, decorridos: number): boolean {
  return !a.concluida && decorridos < a.ef && a.ef <= decorridos + 5;
}

/** Deve começar nesta semana: não concluída, início previsto cai na janela. */
export function comecarNaSemana(a: AtividadeSemana, decorridos: number): boolean {
  return !a.concluida && decorridos <= a.es && a.es < decorridos + 5;
}

/** Era para concluir na semana passada (fim previsto na janela anterior). */
export function semanaPassadaConcluir(a: AtividadeSemana, decorridos: number): boolean {
  return decorridos - 5 < a.ef && a.ef <= decorridos;
}

/** Era para começar na semana passada (início previsto na janela anterior). */
export function semanaPassadaComecar(a: AtividadeSemana, decorridos: number): boolean {
  return decorridos - 5 <= a.es && a.es < decorridos;
}

export interface SemanaObra<T extends AtividadeSemana> {
  concluir: T[];
  comecar: T[];
  passadaConcluir: T[];
  passadaComecar: T[];
}

export function classificarSemana<T extends AtividadeSemana>(
  atividades: T[],
  decorridos: number,
): SemanaObra<T> {
  const concluir: T[] = [];
  const comecar: T[] = [];
  const passadaConcluir: T[] = [];
  const passadaComecar: T[] = [];
  for (const a of atividades) {
    if (concluirNaSemana(a, decorridos)) concluir.push(a);
    if (comecarNaSemana(a, decorridos)) comecar.push(a);
    if (semanaPassadaConcluir(a, decorridos)) passadaConcluir.push(a);
    if (semanaPassadaComecar(a, decorridos)) passadaComecar.push(a);
  }
  const porEs = (x: T, y: T) => x.es - y.es;
  concluir.sort((x, y) => x.ef - y.ef);
  comecar.sort(porEs);
  passadaConcluir.sort((x, y) => x.ef - y.ef);
  passadaComecar.sort(porEs);
  return { concluir, comecar, passadaConcluir, passadaComecar };
}

export interface ProvidenciaSemanaArgs {
  status: 'pendente' | 'feito';
  esAtividade: number;
  antecedenciaDu: number;
  decorridos: number;
  atividadeConcluida: boolean;
  obraIniciada: boolean;
}

/** Providenciar nesta semana: pendente, NÃO atrasada, limite dentro da janela. */
export function providenciarNaSemana(a: ProvidenciaSemanaArgs): boolean {
  if (a.status !== 'pendente') return false;
  if (
    providenciaAtrasada({
      status: a.status,
      atividadeConcluida: a.atividadeConcluida,
      obraIniciada: a.obraIniciada,
      decorridos: a.decorridos,
      esAtividade: a.esAtividade,
      antecedenciaDu: a.antecedenciaDu,
    })
  ) {
    return false;
  }
  const limite = Math.max(limiteProvidencia(a.esAtividade, a.antecedenciaDu), 0);
  return limite < a.decorridos + 5;
}
