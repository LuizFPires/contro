// Agendamento do boletim automático (config global do gestor).
// dia da semana em ISO: 1=segunda … 7=domingo. Funções puras e testadas;
// a geração em si e o envio ficam nas fatias seguintes (pg_cron + push).

export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type EdicaoAgenda = 'principal' | 'fechamento';

export interface ConfigBoletim {
  /** Liga/desliga todo o agendamento. */
  ativo: boolean;
  diaSemana: DiaSemana;
  /** 'HH:MM' (24h). */
  hora: string;
  /** Edição de fechamento (ex.: sexta 17:00), opcional. */
  fechamentoAtivo: boolean;
  fechamentoDia: DiaSemana;
  fechamentoHora: string;
}

export interface Disparo {
  quando: Date;
  edicao: EdicaoAgenda;
  diaSemana: number;
}

const NOMES = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Nome do dia da semana ISO (1=segunda … 7=domingo). */
export function nomeDiaSemana(dia: number): string {
  return NOMES[dia - 1] ?? '';
}

/** null = válido; senão, a mensagem do erro. */
export function validarConfigBoletim(c: ConfigBoletim): string | null {
  if (c.diaSemana < 1 || c.diaSemana > 7) return 'Dia da semana inválido.';
  if (!RE_HORA.test(c.hora)) return 'Horário inválido.';
  if (c.fechamentoAtivo) {
    if (c.fechamentoDia < 1 || c.fechamentoDia > 7) return 'Dia de fechamento inválido.';
    if (!RE_HORA.test(c.fechamentoHora)) return 'Horário de fechamento inválido.';
  }
  return null;
}

/** ISO do dia da semana de uma data no fuso local (1=segunda … 7=domingo). */
function isodowLocal(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

/** Próxima ocorrência (>= agora) do dia/hora no fuso local de `agora`. */
function proximaOcorrencia(agora: Date, dia: number, hora: string): Date {
  const [h, m] = hora.split(':').map(Number);
  const delta = (dia - isodowLocal(agora) + 7) % 7;
  const cand = new Date(agora);
  cand.setHours(h, m, 0, 0);
  cand.setDate(cand.getDate() + delta);
  if (cand.getTime() <= agora.getTime()) cand.setDate(cand.getDate() + 7);
  return cand;
}

/**
 * O próximo disparo do boletim a partir de `agora`, considerando a edição
 * principal e, se ligada, a de fechamento. null quando o agendamento está
 * desligado. Cálculo no fuso local de `agora` (exibição); o cron trata o fuso.
 */
export function proximoDisparo(c: ConfigBoletim, agora: Date): Disparo | null {
  if (!c.ativo) return null;
  const cands: Disparo[] = [
    {
      quando: proximaOcorrencia(agora, c.diaSemana, c.hora),
      edicao: 'principal',
      diaSemana: c.diaSemana,
    },
  ];
  if (c.fechamentoAtivo) {
    cands.push({
      quando: proximaOcorrencia(agora, c.fechamentoDia, c.fechamentoHora),
      edicao: 'fechamento',
      diaSemana: c.fechamentoDia,
    });
  }
  cands.sort((a, b) => a.quando.getTime() - b.quando.getTime());
  return cands[0];
}
