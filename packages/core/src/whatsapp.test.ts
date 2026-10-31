import { describe, expect, it } from 'vitest';
import { bolinha, cabecalhoObra, secao, temperaturaPrazo } from './whatsapp';

const HOJE = '2026-10-31';

describe('temperatura do prazo (WhatsApp)', () => {
  it('feito, atrasado, até 7 dias, em dia e sem resposta', () => {
    expect(temperaturaPrazo({ feito: true, atraso: true }, HOJE)).toBe('feito');
    expect(temperaturaPrazo({ atraso: true }, HOJE)).toBe('atrasado');
    expect(temperaturaPrazo({ data: '2026-10-30' }, HOJE)).toBe('atrasado');
    expect(temperaturaPrazo({ data: '2026-10-31' }, HOJE)).toBe('alerta');
    expect(temperaturaPrazo({ data: '2026-11-07' }, HOJE)).toBe('alerta');
    expect(temperaturaPrazo({ data: '2026-11-08' }, HOJE)).toBe('em_dia');
    expect(temperaturaPrazo({}, HOJE)).toBe('em_dia');
    expect(temperaturaPrazo({ semResposta: true, data: '2026-11-02' }, HOJE)).toBe('sem_resposta');
    expect(temperaturaPrazo({ semResposta: true, data: '2026-10-20' }, HOJE)).toBe('atrasado');
  });

  it('bolinhas e blocos de texto', () => {
    expect(bolinha({ atraso: true }, HOJE)).toBe('🔴');
    expect(bolinha({ data: '2026-11-03' }, HOJE)).toBe('🟡');
    expect(bolinha({ data: '2026-12-01' }, HOJE)).toBe('🔵');
    expect(bolinha({ feito: true }, HOJE)).toBe('🟢');
    expect(cabecalhoObra('CDC - Paquetá', '8% · no ritmo')).toEqual([
      '*🏗 CDC - PAQUETÁ*',
      '_8% · no ritmo_',
    ]);
    expect(secao('📅 Semana que vem', [])).toEqual([]);
    expect(secao('📅 Semana que vem', ['- 🔵 X'])).toEqual(['', '*📅 Semana que vem*', '- 🔵 X']);
  });
});
