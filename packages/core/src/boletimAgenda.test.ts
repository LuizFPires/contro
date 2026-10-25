import { describe, it, expect } from 'vitest';
import {
  nomeDiaSemana,
  validarConfigBoletim,
  proximoDisparo,
  type ConfigBoletim,
} from './boletimAgenda';

const base: ConfigBoletim = {
  ativo: true,
  diaSemana: 1, // segunda
  hora: '06:30',
  fechamentoAtivo: false,
  fechamentoDia: 5, // sexta
  fechamentoHora: '17:00',
};

describe('nomeDiaSemana', () => {
  it('mapeia ISO 1..7', () => {
    expect(nomeDiaSemana(1)).toBe('segunda');
    expect(nomeDiaSemana(5)).toBe('sexta');
    expect(nomeDiaSemana(7)).toBe('domingo');
  });
});

describe('validarConfigBoletim', () => {
  it('aceita config válida', () => {
    expect(validarConfigBoletim(base)).toBeNull();
  });
  it('rejeita horário inválido', () => {
    expect(validarConfigBoletim({ ...base, hora: '25:00' })).toMatch(/Horário/);
    expect(validarConfigBoletim({ ...base, hora: '6:30' })).toMatch(/Horário/);
  });
  it('rejeita dia fora de 1..7', () => {
    expect(validarConfigBoletim({ ...base, diaSemana: 0 as unknown as 1 })).toMatch(/Dia/);
  });
  it('valida fechamento só quando ligado', () => {
    expect(validarConfigBoletim({ ...base, fechamentoHora: '99:99' })).toBeNull();
    expect(
      validarConfigBoletim({ ...base, fechamentoAtivo: true, fechamentoHora: '99:99' }),
    ).toMatch(/fechamento/);
  });
});

describe('proximoDisparo', () => {
  it('desligado devolve null', () => {
    expect(proximoDisparo({ ...base, ativo: false }, new Date(2026, 0, 7, 10, 0))).toBeNull();
  });

  it('acha a próxima segunda 06:30 a partir de uma quarta', () => {
    // quarta 2026-01-07 10:00 → próxima segunda 2026-01-12 06:30
    const d = proximoDisparo(base, new Date(2026, 0, 7, 10, 0));
    expect(d?.edicao).toBe('principal');
    expect(d?.quando.getFullYear()).toBe(2026);
    expect(d?.quando.getMonth()).toBe(0);
    expect(d?.quando.getDate()).toBe(12);
    expect(d?.quando.getHours()).toBe(6);
    expect(d?.quando.getMinutes()).toBe(30);
  });

  it('se hoje é o dia mas a hora já passou, vai para a próxima semana', () => {
    // segunda 2026-01-05 08:00, principal segunda 06:30 → 2026-01-12
    const d = proximoDisparo(base, new Date(2026, 0, 5, 8, 0));
    expect(d?.quando.getDate()).toBe(12);
  });

  it('com fechamento ligado, pega a edição mais próxima', () => {
    // quarta 2026-01-07 10:00; principal seg 12 06:30 vs fechamento sex 09 17:00 → sexta
    const cfg: ConfigBoletim = { ...base, fechamentoAtivo: true };
    const d = proximoDisparo(cfg, new Date(2026, 0, 7, 10, 0));
    expect(d?.edicao).toBe('fechamento');
    expect(d?.quando.getDate()).toBe(9);
    expect(d?.quando.getHours()).toBe(17);
  });
});
