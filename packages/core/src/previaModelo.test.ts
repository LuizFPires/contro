import { describe, expect, it } from 'vitest';
import { previaAtividadeModelo } from './previaModelo';

// A(2) -> B(5); C(1) paralela a B. Total 7.
const modelo = [
  { id: 'A', duracao_du: 2 },
  { id: 'B', duracao_du: 5, predecessoras: ['A'] },
  { id: 'C', duracao_du: 1, predecessoras: ['A'] },
];

describe('previaAtividadeModelo', () => {
  it('nova atividade com folga', () => {
    const p = previaAtividadeModelo(modelo, { duracao_du: 2, predecessoras: ['A'] });
    expect(p).toMatchObject({ diaInicio: 3, diaFim: 4, totalAntes: 7, totalDepois: 7, folga: 3 });
    expect(p.texto).toBe('3 d de folga');
  });

  it('nova atividade que alonga a obra', () => {
    const p = previaAtividadeModelo(modelo, { duracao_du: 3, predecessoras: ['B'] });
    expect(p).toMatchObject({ diaInicio: 8, diaFim: 10, totalDepois: 10 });
    expect(p.texto).toBe('aumenta a obra em 3 d');
  });

  it('edição: substitui a atividade e reporta caminho crítico', () => {
    const p = previaAtividadeModelo(modelo, { id: 'B', duracao_du: 5, predecessoras: ['A'] });
    expect(p).toMatchObject({ diaInicio: 3, diaFim: 7, totalDepois: 7, critico: true });
    expect(p.texto).toBe('caminho crítico');
  });
});
