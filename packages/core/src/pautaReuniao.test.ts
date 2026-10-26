import { describe, expect, it } from 'vitest';
import {
  avisoProvidencia,
  datasProvidencia,
  proximaReuniao,
  simularConclusaoEm,
  voltaNaProximaReuniao,
} from './pautaReuniao';

const INICIO = '2026-11-02'; // segunda
// A(3) -> B(4) -> C(2): B vai de qui 05/11 a ter 10/11; entrega qui 12/11.
const atvs = [
  { id: 'A', duracao_du: 3 },
  { id: 'B', duracao_du: 4, predecessoras: ['A'] },
  { id: 'C', duracao_du: 2, predecessoras: ['B'] },
];

describe('simularConclusaoEm', () => {
  it('concluir 2 dias úteis depois empurra a entrega em 2', () => {
    expect(simularConclusaoEm(INICIO, atvs, 'B', '2026-11-12')).toEqual({
      fimAntes: '2026-11-10',
      fimDepois: '2026-11-12',
      entregaAntes: '2026-11-12',
      entregaDepois: '2026-11-16',
      deltaEntrega: 2,
    });
  });

  it('data antes do fim previsto não encurta a atividade', () => {
    const r = simularConclusaoEm(INICIO, atvs, 'B', '2026-11-06');
    expect(r?.fimDepois).toBe('2026-11-10');
    expect(r?.deltaEntrega).toBe(0);
  });

  it('atividade com subitens ou inexistente não simula', () => {
    const comSub = [...atvs, { id: 'B1', duracao_du: 1, pai_id: 'B' }];
    expect(simularConclusaoEm(INICIO, comSub, 'B', '2026-11-12')).toBeNull();
    expect(simularConclusaoEm(INICIO, atvs, 'X', '2026-11-12')).toBeNull();
  });
});

describe('datas e próxima reunião', () => {
  it('próximos dias úteis pulam o fim de semana', () => {
    expect(datasProvidencia('2026-10-29', 3)).toEqual(['2026-10-30', '2026-11-02', '2026-11-03']);
  });

  it('próxima reunião é a segunda seguinte', () => {
    expect(proximaReuniao('2026-10-26')).toBe('2026-11-02');
    expect(voltaNaProximaReuniao('2026-10-26', '2026-10-30')).toBe(false);
    expect(voltaNaProximaReuniao('2026-10-26', '2026-11-02')).toBe(true);
  });
});

describe('avisoProvidencia', () => {
  it('nesta semana: tarefas até o prazo', () => {
    expect(
      avisoProvidencia({
        responsavel: 'Rafael',
        prazoFmt: 'qui 29/10',
        proximaFmt: 'seg 02/11',
        volta: false,
      }),
    ).toBe(
      'Entra nas Tarefas de Rafael até qui 29/10. Na reunião de seg 02/11 aparece para conferir se foi feita.',
    );
  });

  it('semana que vem: volta na próxima reunião; sem responsável', () => {
    expect(
      avisoProvidencia({
        responsavel: null,
        prazoFmt: 'qua 04/11',
        proximaFmt: 'seg 02/11',
        volta: true,
      }),
    ).toBe(
      'Entra nas Tarefas (sem responsável) e volta na reunião de seg 02/11, em "Providências da reunião anterior".',
    );
  });
});
