// Dia e horário da reunião semanal e os lembretes por push (pedido do usuário,
// 28/10/2026). O gestor escolhe o dia (seg a sex) e o horário; os lembretes
// saem de manhã no dia da reunião e um tempo antes de começar. O servidor
// (gerar_avisos) usa a mesma regra; aqui ficam as datas e os textos da tela.
import { type DataISO } from './calendar';

/** Dia da semana da reunião, ISO: 1 = segunda … 5 = sexta. */
export type DiaReuniao = 1 | 2 | 3 | 4 | 5;

export const DIAS_REUNIAO: { dia: DiaReuniao; curto: string }[] = [
  { dia: 1, curto: 'seg' },
  { dia: 2, curto: 'ter' },
  { dia: 3, curto: 'qua' },
  { dia: 4, curto: 'qui' },
  { dia: 5, curto: 'sex' },
];

/** Antecedência do lembrete "antes de começar", em minutos. */
export const ANTECEDENCIAS_REUNIAO = [30, 60, 120] as const;

function somarDias(data: DataISO, dias: number): DataISO {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Dia ISO da semana (1 = segunda … 7 = domingo) de uma data. */
function diaIso(data: DataISO): number {
  const d = new Date(`${data}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Data da reunião da semana de `hoje` (a reunião desta semana, já passada ou não). */
export function reuniaoDaSemana(hoje: DataISO, dia: DiaReuniao): DataISO {
  return somarDias(hoje, dia - diaIso(hoje));
}

/**
 * A reunião que vem (pedido do usuário, 30/10/2026): a do dia da reunião desta
 * semana até o fim desse dia (a pauta pode ser fechada depois do horário);
 * passado o dia, a da semana que vem. O card da tela inicial e a pauta usam esta.
 */
export function reuniaoQueVem(hoje: DataISO, dia: DiaReuniao): DataISO {
  const desta = reuniaoDaSemana(hoje, dia);
  return desta >= hoje ? desta : somarDias(desta, 7);
}

/** A reunião anterior a `data` (uma semana antes). */
export function reuniaoAnterior(data: DataISO): DataISO {
  return somarDias(data, -7);
}

/** "HH:MM" → minutos do dia. */
export function minutosDoDia(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Minutos do dia → "HH:MM" (limita ao dia: 00:00 a 23:59). */
export function horaDeMinutos(min: number): string {
  const v = Math.min(23 * 60 + 59, Math.max(0, Math.round(min)));
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

/** Hora do lembrete "antes de começar" (ex.: reunião 16:00, 60 min → "15:00"). */
export function horaLembreteAntes(horaReuniao: string, antecedenciaMin: number): string {
  return horaDeMinutos(minutosDoDia(horaReuniao) - antecedenciaMin);
}

/**
 * Próxima reunião a partir de agora: a desta semana se ainda não começou, senão
 * a da semana que vem.
 */
export function proximaDataReuniao(
  hoje: DataISO,
  agora: string,
  dia: DiaReuniao,
  horaReuniao: string,
): DataISO {
  const desta = reuniaoDaSemana(hoje, dia);
  const passou =
    desta < hoje || (desta === hoje && minutosDoDia(agora) >= minutosDoDia(horaReuniao));
  return passou ? somarDias(desta, 7) : desta;
}

/** "16h" ou "16h30", como a reunião aparece nos textos. */
export function horaCurta(hora: string): string {
  const [h, m] = hora.split(':');
  return m && m !== '00' ? `${Number(h)}h${m}` : `${Number(h)}h`;
}

/** "1 hora", "30 min", "2 horas" para o lembrete. */
export function textoAntecedencia(min: number): string {
  if (min % 60 === 0) {
    const h = min / 60;
    return `${h} ${h === 1 ? 'hora' : 'horas'}`;
  }
  return `${min} min`;
}
