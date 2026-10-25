// Casos do protótipo (SPEC §Testes): os indicadores do core batem com os números
// mostrados no protótipo. Eldorado é o caso documentado (47% / 53% / −3);
// Pampulha e Betim travam a saída do core para as mesmas obras do protótipo.
import { describe, expect, it } from 'vitest';
import { estadoObra } from './obra';
import { ritmoTexto } from './indicadores';
import { calcularCronograma } from './schedule';
import { MODELO_1 } from './modelos.fixture';

function indicadores(inicio: string, hoje: string, concluidasTopo: (n: number) => boolean) {
  const cron = calcularCronograma({ inicio, atividades: MODELO_1 });
  const topo = MODELO_1.filter((a) => !a.pai_id).map((a) => a.id);
  const concluidas = new Set<string>();
  for (const a of MODELO_1) if (!a.pai_id && concluidasTopo(Number(a.id))) concluidas.add(a.id);
  const predecessoras: Record<string, string[]> = {};
  for (const it of cron.itens) {
    predecessoras[it.id] = MODELO_1.find((a) => a.id === it.id)?.predecessoras ?? [];
  }
  return estadoObra({
    inicio,
    hoje,
    cronograma: cron,
    predecessoras,
    concluidas,
    provOk: new Set(topo),
  }).indicadores;
}

const pct = (x: number) => Math.round(x * 100);

describe('cenários do protótipo', () => {
  it('Eldorado: 47% real · 53% previsto hoje · ritmo −3 (SPEC)', () => {
    const i = indicadores('2026-09-21', '2026-10-24', (n) => (n >= 1 && n <= 11) || n === 14);
    expect(pct(i.real)).toBe(47);
    expect(pct(i.previstoHoje)).toBe(53);
    expect(i.ritmoDias).toBe(-3);
    expect(ritmoTexto(i.ritmoDias)).toEqual({ texto: 'Atrasada · 3 dias', atrasada: true });
  });

  it('Pampulha: adiantada no real mas atrás do previsto (ritmo −7)', () => {
    const i = indicadores('2026-08-17', '2026-10-24', (n) => (n >= 1 && n <= 20) || n === 22);
    expect(pct(i.real)).toBe(84);
    expect(pct(i.previstoHoje)).toBe(97);
    expect(i.ritmoDias).toBe(-7);
  });

  it('Betim: início recente, pouco avanço (ritmo −1, no ritmo)', () => {
    const i = indicadores('2026-10-13', '2026-10-24', (n) => n === 1 || n === 2);
    expect(pct(i.real)).toBe(6);
    expect(i.ritmoDias).toBe(-1);
    expect(ritmoTexto(i.ritmoDias).atrasada).toBe(false); // −1 ainda é "No ritmo"
  });
});
