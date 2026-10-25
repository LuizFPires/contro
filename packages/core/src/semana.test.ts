import { describe, expect, it } from 'vitest';
import {
  classificarSemana,
  comecarNaSemana,
  concluirNaSemana,
  providenciarNaSemana,
  semanaPassadaComecar,
  semanaPassadaConcluir,
  type AtividadeSemana,
} from './semana';

const a = (p: Partial<AtividadeSemana>): AtividadeSemana => ({
  id: p.id ?? 'x',
  es: p.es ?? 0,
  ef: p.ef ?? 1,
  concluida: p.concluida ?? false,
  liberada: p.liberada ?? false,
});

// decorridos = 10 → esta semana [10,15); passada [5,10)
describe('janelas da semana (decorridos=10)', () => {
  it('concluir nesta semana: 10 < ef <= 15', () => {
    expect(concluirNaSemana(a({ ef: 12 }), 10)).toBe(true);
    expect(concluirNaSemana(a({ ef: 10 }), 10)).toBe(false); // ef=10 é passada
    expect(concluirNaSemana(a({ ef: 16 }), 10)).toBe(false);
    expect(concluirNaSemana(a({ ef: 12, concluida: true }), 10)).toBe(false);
  });
  it('começar nesta semana: 10 <= es < 15', () => {
    expect(comecarNaSemana(a({ es: 10 }), 10)).toBe(true);
    expect(comecarNaSemana(a({ es: 14 }), 10)).toBe(true);
    expect(comecarNaSemana(a({ es: 15 }), 10)).toBe(false);
    expect(comecarNaSemana(a({ es: 9 }), 10)).toBe(false);
  });
  it('semana passada: janela [5,10)', () => {
    expect(semanaPassadaConcluir(a({ ef: 8 }), 10)).toBe(true);
    expect(semanaPassadaConcluir(a({ ef: 10 }), 10)).toBe(true); // ef=10 fecha a janela anterior
    expect(semanaPassadaConcluir(a({ ef: 5 }), 10)).toBe(false);
    expect(semanaPassadaComecar(a({ es: 5 }), 10)).toBe(true);
    expect(semanaPassadaComecar(a({ es: 10 }), 10)).toBe(false);
  });
});

describe('classificarSemana ordena por es/ef', () => {
  it('ordena', () => {
    const r = classificarSemana(
      [a({ id: 'a', es: 12, ef: 14 }), a({ id: 'b', es: 10, ef: 11 })],
      10,
    );
    expect(r.comecar.map((x) => x.id)).toEqual(['b', 'a']);
    expect(r.concluir.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('providenciarNaSemana', () => {
  const base = {
    status: 'pendente' as const,
    esAtividade: 12,
    antecedenciaDu: 3, // limite = 9
    atividadeConcluida: false,
    obraIniciada: true,
  };
  it('pendente, não atrasada, limite < decorridos+5', () => {
    // decorridos=5 → não atrasada (5 < 9) e limite 9 < 10
    expect(providenciarNaSemana({ ...base, decorridos: 5 })).toBe(true);
  });
  it('exclui atrasada (decorridos >= limite)', () => {
    expect(providenciarNaSemana({ ...base, decorridos: 9 })).toBe(false);
  });
  it('exclui já feita', () => {
    expect(providenciarNaSemana({ ...base, status: 'feito', decorridos: 5 })).toBe(false);
  });
});
