import { describe, expect, it } from 'vitest';
import { calcularCronograma } from './schedule';
import {
  planoRecuperacao,
  previsaoEntrega,
  simularPlano,
  tarefasDoPlano,
  type EntradaRecuperacao,
} from './recuperacao';

const INICIO = '2026-11-02'; // segunda
// A(3) -> B(5) -> C(5) -> D(3): plano termina no dia útil 16.
const atividades = [
  { id: 'A', duracao_du: 3 },
  { id: 'B', duracao_du: 5, predecessoras: ['A'] },
  { id: 'C', duracao_du: 5, predecessoras: ['B'] },
  { id: 'D', duracao_du: 3, predecessoras: ['C'] },
];
const nomes = { A: 'Demolição', B: 'Alvenaria', C: 'Elétrica', D: 'Pintura' };
const original = calcularCronograma({ inicio: INICIO, atividades }).entrega;

function entrada(p: Partial<EntradaRecuperacao> = {}): EntradaRecuperacao {
  // Hoje = dia útil 5 (seg 09/11): A devia ter terminado no dia 3 e está aberta.
  return {
    inicio: INICIO,
    hoje: '2026-11-09',
    atividades,
    concluidas: new Set(),
    nomes,
    entregaOriginal: original,
    ...p,
  };
}

describe('schedule · defasagem (paralelismo)', () => {
  it('-2 faz a sucessora começar 2 dias antes do fim da predecessora', () => {
    const c = calcularCronograma({
      inicio: INICIO,
      atividades: atividades.map((a) => (a.id === 'C' ? { ...a, defasagens: { B: -2 } } : a)),
    });
    expect(c.porId.C.es).toBe(c.porId.B.ef - 2);
    expect(c.total).toBe(14);
    expect(c.porId.C.critico).toBe(true);
  });
});

describe('previsaoEntrega', () => {
  it('atividade atrasada termina hoje e empurra as seguintes', () => {
    const p = previsaoEntrega(entrada());
    expect(p.cronograma.porId.A.ef).toBe(6);
    expect(p.atrasoDu).toBe(3);
    expect(p.entregaPrevista > p.entregaOriginal).toBe(true);
  });

  it('sem atraso quando a atrasada já foi concluída', () => {
    expect(previsaoEntrega(entrada({ concluidas: new Set(['A']) })).atrasoDu).toBe(0);
  });
});

describe('planoRecuperacao', () => {
  it('sugere redução e paralelismo nas próximas críticas e recomenda o que zera o atraso', () => {
    const e = entrada();
    const plano = planoRecuperacao(e);
    const tipos = new Set(plano.sugestoes.map((s) => s.tipo));
    expect(tipos).toEqual(new Set(['reducao', 'paralelismo']));
    expect(plano.sugestoes.every((s) => s.ganhoDu > 0)).toBe(true);
    // Nada na atividade atrasada (A): só nas que ainda não começaram.
    expect(plano.sugestoes.some((s) => s.atividadeId === 'A')).toBe(false);
    const rec = plano.sugestoes.filter((s) => plano.recomendadas.includes(s.chave));
    expect(simularPlano(e, rec).atrasoDu).toBe(0);
  });

  it('paralelismo não faz começar antes de hoje', () => {
    const plano = planoRecuperacao(entrada());
    const par = plano.sugestoes.find((s) => s.chave === 'paralelismo-A-B');
    // A termina hoje (dia 5); B só pode começar hoje: ganha 1, não 2.
    expect(par?.ganhoDu).toBe(1);
  });

  it('obra no prazo não tem plano', () => {
    const p = planoRecuperacao(entrada({ concluidas: new Set(['A']) }));
    expect(p.sugestoes).toEqual([]);
    expect(p.recomendadas).toEqual([]);
  });
});

describe('tarefasDoPlano', () => {
  it('uma providência por sugestão, 2 dias úteis antes do novo início e nunca antes de hoje', () => {
    const e = entrada();
    const plano = planoRecuperacao(e);
    const rec = plano.sugestoes.filter((s) => plano.recomendadas.includes(s.chave));
    const t = tarefasDoPlano(e, rec);
    expect(t).toHaveLength(rec.length);
    expect(t.every((x) => x.prazo >= e.hoje)).toBe(true);
    expect(t[0].texto).toBe(rec[0].precisa);
  });
});
