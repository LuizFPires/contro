import { expect, it } from 'vitest';
import { numerosPorVinculo } from './numeracaoObra';
import type { ObraCompleta } from './detalhe';

it('usa a mesma numeração da obra para atividade, subitem e suas providências', () => {
  const obra = {
    fases: [
      { id: 'f2', ordem: 2 },
      { id: 'f1', ordem: 1 },
    ],
    atividades: [
      {
        id: 'contrapiso',
        fase_id: 'f2',
        ordem: 1,
        pai_id: null,
        providencias: [{ id: 'cimento2' }],
      },
      {
        id: 'sub',
        fase_id: 'f1',
        ordem: 1,
        pai_id: 'alvenaria',
        providencias: [{ id: 'provSub' }],
      },
      {
        id: 'alvenaria',
        fase_id: 'f1',
        ordem: 1,
        pai_id: null,
        providencias: [{ id: 'cimento1' }],
      },
    ],
  } as unknown as ObraCompleta;
  expect(numerosPorVinculo(obra)).toEqual({
    alvenaria: 1,
    cimento1: 1,
    sub: 1,
    provSub: 1,
    contrapiso: 2,
    cimento2: 2,
  });
});
