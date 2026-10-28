import { describe, expect, it } from 'vitest';
import {
  horaCurta,
  horaDeMinutos,
  horaLembreteAntes,
  minutosDoDia,
  proximaDataReuniao,
  reuniaoDaSemana,
  textoAntecedencia,
} from './agendaReuniao';

// 2026-10-28 é quarta-feira.
const QUA = '2026-10-28';

describe('agenda da reunião', () => {
  it('reunião da semana: segunda e sexta da mesma semana', () => {
    expect(reuniaoDaSemana(QUA, 1)).toBe('2026-10-26');
    expect(reuniaoDaSemana(QUA, 3)).toBe('2026-10-28');
    expect(reuniaoDaSemana(QUA, 5)).toBe('2026-10-30');
    // Domingo pertence à semana que começou na segunda anterior.
    expect(reuniaoDaSemana('2026-11-01', 1)).toBe('2026-10-26');
  });

  it('próxima reunião: a desta semana se ainda não começou', () => {
    expect(proximaDataReuniao(QUA, '09:00', 5, '16:00')).toBe('2026-10-30');
    expect(proximaDataReuniao(QUA, '15:59', 3, '16:00')).toBe('2026-10-28');
  });

  it('próxima reunião: passou (dia ou hora), vai para a semana que vem', () => {
    expect(proximaDataReuniao(QUA, '09:00', 1, '16:00')).toBe('2026-11-02');
    expect(proximaDataReuniao(QUA, '16:00', 3, '16:00')).toBe('2026-11-04');
  });

  it('hora do lembrete antes de começar', () => {
    expect(horaLembreteAntes('16:00', 60)).toBe('15:00');
    expect(horaLembreteAntes('16:00', 30)).toBe('15:30');
    expect(horaLembreteAntes('08:30', 120)).toBe('06:30');
    expect(horaLembreteAntes('00:30', 60)).toBe('00:00');
  });

  it('conversões de hora e textos', () => {
    expect(minutosDoDia('07:45')).toBe(465);
    expect(horaDeMinutos(465)).toBe('07:45');
    expect(horaCurta('16:00')).toBe('16h');
    expect(horaCurta('09:30')).toBe('9h30');
    expect(textoAntecedencia(60)).toBe('1 hora');
    expect(textoAntecedencia(120)).toBe('2 horas');
    expect(textoAntecedencia(30)).toBe('30 min');
  });
});
