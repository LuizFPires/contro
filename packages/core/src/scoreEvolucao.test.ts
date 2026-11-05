import { describe, expect, it } from 'vitest';
import { evolucaoScore, variacaoScore, type RegistroScoreDia } from './scoreEvolucao';

const HOJE = '2026-11-05'; // quinta
const r = (
  dia: string,
  score30: number | null,
  score90: number | null = score30,
): RegistroScoreDia => ({
  dia,
  score30,
  score90,
});

describe('evolucaoScore', () => {
  it('ordena os dias fechados e põe hoje aberto no fim', () => {
    const e = evolucaoScore([r('2026-11-04', 61), r('2026-11-03', 71)], 60, HOJE, 30);
    expect(e.pontos).toEqual([
      { dia: '2026-11-03', score: 71, aberto: false },
      { dia: '2026-11-04', score: 61, aberto: false },
      { dia: HOJE, score: 60, aberto: true },
    ]);
  });

  it('ignora fim de semana, dia sem score, fora da janela e o registro de hoje', () => {
    const e = evolucaoScore(
      [
        r('2026-10-31', 80), // sábado
        r('2026-11-02', null), // sem score
        r('2026-10-06', 90), // 30 dias corridos terminando em 05/11 começam em 07/10
        r('2026-11-05', 50), // hoje vem de "agora"
        r('2026-10-07', 70),
      ],
      null,
      HOJE,
      30,
    );
    expect(e.pontos.map((p) => p.dia)).toEqual(['2026-10-07']);
  });

  it('usa o score da janela escolhida', () => {
    const e = evolucaoScore([r('2026-11-04', 61, 72)], 61, HOJE, 90);
    expect(e.pontos[0]!.score).toBe(72);
  });

  it('marca maior e menor só entre os dias fechados (o mais recente no empate)', () => {
    const e = evolucaoScore(
      [r('2026-11-02', 80), r('2026-11-03', 61), r('2026-11-04', 80)],
      99,
      HOJE,
      30,
    );
    expect(e.maior?.dia).toBe('2026-11-04');
    expect(e.menor?.dia).toBe('2026-11-03');
  });

  it('sem histórico e sem score: série vazia', () => {
    expect(evolucaoScore([], null, HOJE, 30)).toEqual({ pontos: [], maior: null, menor: null });
  });
});

describe('variacaoScore', () => {
  const { pontos } = evolucaoScore(
    [r('2026-10-30', 75), r('2026-11-03', 71), r('2026-11-04', 61)],
    61,
    HOJE,
    30,
  );
  it('desde ontem quando o ponto é ontem e o anterior é o dia útil de antes', () => {
    expect(variacaoScore(pontos, 2, HOJE)).toEqual({ delta: -10, desdeOntem: true, eOntem: true });
  });
  it('dia que não é ontem não diz "ontem"', () => {
    expect(variacaoScore(pontos, 1, HOJE)).toEqual({ delta: -4, desdeOntem: false, eOntem: false });
  });
  it('último dia fechado antes de ontem não é "ontem"', () => {
    const { pontos: p } = evolucaoScore([r('2026-11-02', 80), r('2026-11-03', 71)], 61, HOJE, 30);
    expect(variacaoScore(p, 1, HOJE)).toEqual({ delta: -9, desdeOntem: false, eOntem: false });
  });
  it('primeiro ponto e hoje não têm variação', () => {
    expect(variacaoScore(pontos, 0, HOJE)).toBeNull();
    expect(variacaoScore(pontos, 3, HOJE)).toBeNull();
  });
});
