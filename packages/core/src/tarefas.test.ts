import { describe, expect, it } from 'vitest';
import { classificarTarefas, tarefaAtrasada, textoReplanejamento, type Tarefa } from './tarefas';

const t = (p: Partial<Tarefa>): Tarefa => ({
  id: p.id ?? 'x',
  status: p.status ?? 'aberta',
  prazo: p.prazo ?? '2026-10-30',
  prazo_original: p.prazo_original ?? null,
  replanejamentos: p.replanejamentos ?? 0,
});

describe('tarefaAtrasada', () => {
  it('aberta e vencida', () => {
    expect(tarefaAtrasada({ status: 'aberta', prazo: '2026-10-20' }, '2026-10-24')).toBe(true);
  });
  it('aberta no prazo não é atrasada', () => {
    expect(tarefaAtrasada({ status: 'aberta', prazo: '2026-10-24' }, '2026-10-24')).toBe(false);
  });
  it('feita nunca é atrasada', () => {
    expect(tarefaAtrasada({ status: 'feita', prazo: '2026-01-01' }, '2026-10-24')).toBe(false);
  });
});

describe('classificarTarefas', () => {
  it('separa e ordena por prazo', () => {
    const ts = [
      t({ id: 'a', status: 'aberta', prazo: '2026-10-28' }),
      t({ id: 'b', status: 'aberta', prazo: '2026-10-19' }), // atrasada
      t({ id: 'c', status: 'feita', prazo: '2026-10-10' }),
      t({ id: 'd', status: 'aberta', prazo: '2026-10-25' }),
      t({ id: 'e', status: 'aberta', prazo: '2026-10-18' }), // atrasada
    ];
    const r = classificarTarefas(ts, '2026-10-24');
    expect(r.atrasadas.map((x) => x.id)).toEqual(['e', 'b']);
    expect(r.abertas.map((x) => x.id)).toEqual(['d', 'a']);
    expect(r.concluidas.map((x) => x.id)).toEqual(['c']);
  });
});

describe('textoReplanejamento (aceite M6)', () => {
  it('nunca replanejada → null', () => {
    expect(textoReplanejamento(0, 'qua 21/10')).toBeNull();
  });
  it('1x com prazo original', () => {
    expect(textoReplanejamento(1, 'qua 21/10')).toBe('Replanejada 1x · prazo original qua 21/10');
  });
  it('sem data formatada', () => {
    expect(textoReplanejamento(2, null)).toBe('Replanejada 2x');
  });
});
