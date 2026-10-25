import { describe, it, expect } from 'vitest';
import { addDU } from './calendar';
import { limiteProvidencia, naObraEm, providenciaAtrasada, providenciarAte } from './providencias';

const INICIO = '2026-01-05'; // segunda

describe('providências (SPEC 4.4)', () => {
  it('limite = ES − antecedência', () => {
    expect(limiteProvidencia(10, 3)).toBe(7);
    expect(limiteProvidencia(2, 5)).toBe(-3); // pode ficar negativo
  });

  it('providenciar_até usa max(limite, 0)', () => {
    expect(providenciarAte(INICIO, 10, 3)).toBe(addDU(INICIO, 7));
    expect(providenciarAte(INICIO, 2, 5)).toBe(INICIO); // limite negativo -> início
  });

  it('na_obra_em: override tem prioridade; senão início previsto da atividade', () => {
    expect(naObraEm(INICIO, 5, '2026-02-02')).toBe('2026-02-02');
    expect(naObraEm(INICIO, 5)).toBe(addDU(INICIO, 5));
  });

  it('atrasada quando pendente, obra iniciada e decorridos >= limite', () => {
    expect(
      providenciaAtrasada({
        status: 'pendente',
        atividadeConcluida: false,
        obraIniciada: true,
        decorridos: 8,
        esAtividade: 10,
        antecedenciaDu: 3, // limite 7
      }),
    ).toBe(true);
  });

  it('não atrasada: dentro do prazo, feita, concluída ou obra não iniciada', () => {
    const base = {
      status: 'pendente' as const,
      atividadeConcluida: false,
      obraIniciada: true,
      decorridos: 5,
      esAtividade: 10,
      antecedenciaDu: 3,
    };
    expect(providenciaAtrasada(base)).toBe(false); // 5 < limite 7
    expect(providenciaAtrasada({ ...base, decorridos: 8, status: 'feito' })).toBe(false);
    expect(providenciaAtrasada({ ...base, decorridos: 8, atividadeConcluida: true })).toBe(false);
    expect(providenciaAtrasada({ ...base, decorridos: 8, obraIniciada: false })).toBe(false);
  });
});
