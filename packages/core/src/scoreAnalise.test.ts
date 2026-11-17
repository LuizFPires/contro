import { describe, expect, it } from 'vitest';
import { calcularScoreEquipe, PESOS_EQUIPE, type ItemEquipe, type ItemPrestador } from './score';
import { analisarScoreEquipe, analisarScorePrestador, perdasDoScore } from './scoreAnalise';

// Hoje: terça, 17/11/2026 (janela de 30 dias: 19/10 a 17/11).
const HOJE = '2026-11-17';
let seq = 0;
function tarefa(p: Partial<ItemEquipe> = {}): ItemEquipe {
  seq += 1;
  return {
    id: `t${seq}`,
    origem: 'tarefa',
    obraId: 'o1',
    obraNome: 'CDC - Ressaca',
    texto: `Tarefa ${seq}`,
    chavePessoa: 'thaina',
    nomePessoa: 'Thaina C',
    prazo: '2026-11-03',
    prazoOriginal: '2026-11-03',
    concluidaEm: '2026-11-03T15:00:00',
    replanejamentos: 0,
    excluida: false,
    ...p,
  };
}

/** 13 no prazo e 10 fora (2 abertas), como no protótipo. */
function cenario(): ItemEquipe[] {
  const noPrazo = Array.from({ length: 13 }, () => tarefa());
  const fora = [
    tarefa({
      texto: 'Alugar andaime',
      prazo: '2026-11-04',
      prazoOriginal: '2026-11-04',
      concluidaEm: null,
    }),
    tarefa({
      texto: 'Começar infra de ar-condicionado',
      prazo: '2026-10-31',
      prazoOriginal: '2026-10-22',
      concluidaEm: '2026-11-03T15:00:00',
      replanejamentos: 4,
    }),
    tarefa({
      prazoOriginal: '2026-10-28',
      prazo: '2026-10-28',
      concluidaEm: '2026-11-03T15:00:00',
    }),
    tarefa({
      prazoOriginal: '2026-10-30',
      prazo: '2026-10-30',
      concluidaEm: '2026-11-05T15:00:00',
    }),
    tarefa({
      prazoOriginal: '2026-11-10',
      prazo: '2026-11-10',
      concluidaEm: '2026-11-13T15:00:00',
    }),
    tarefa({
      texto: 'Cobrar ART',
      prazo: '2026-11-13',
      prazoOriginal: '2026-11-13',
      concluidaEm: null,
    }),
    tarefa({
      prazoOriginal: '2026-11-06',
      prazo: '2026-11-07',
      concluidaEm: '2026-11-10T15:00:00',
      replanejamentos: 1,
    }),
    tarefa({
      prazoOriginal: '2026-11-07',
      prazo: '2026-11-07',
      concluidaEm: '2026-11-11T15:00:00',
    }),
    tarefa({
      prazoOriginal: '2026-11-11',
      prazo: '2026-11-11',
      concluidaEm: '2026-11-12T15:00:00',
    }),
    tarefa({
      prazoOriginal: '2026-11-12',
      prazo: '2026-11-12',
      concluidaEm: '2026-11-13T15:00:00',
    }),
  ];
  return [...noPrazo, ...fora, tarefa({ chavePessoa: 'outro', nomePessoa: 'Outro' })];
}

describe('perdasDoScore', () => {
  it('soma exatamente 100 − score e divide o peso de quem não tem base', () => {
    const ind = {
      pontualidade: 13 / 23,
      conclusaoDoDia: 0.75,
      respostaAtraso: 0.5,
      replanejamentos: 0.75,
      pendencias: null,
    };
    const p = perdasDoScore(ind, PESOS_EQUIPE, 62);
    expect(p.reduce((s, x) => s + x.perdidos, 0)).toBe(38);
    expect(p.find((x) => x.indicador === 'pontualidade')).toMatchObject({ vale: 39, perdidos: 17 });
    expect(p.find((x) => x.indicador === 'respostaAtraso')?.perdidos).toBe(11);
    expect(p.find((x) => x.indicador === 'pendencias')).toMatchObject({ vale: 0, perdidos: 0 });
  });
});

describe('analisarScoreEquipe', () => {
  const itens = cenario();
  const a = analisarScoreEquipe(itens, 'thaina', 30, HOJE);
  const linha = calcularScoreEquipe(itens, 30, HOJE).find((l) => l.chave === 'thaina');

  it('usa o mesmo score da tela e os pontos fecham com ele', () => {
    expect(a.score).toBe(linha?.score);
    expect(a.perdas.reduce((s, x) => s + x.perdidos, 0)).toBe(100 - (a.score as number));
  });

  it('pontualidade: 13 de 23, as que tiraram pontos da pior para a melhor', () => {
    const p = a.indicadores.pontualidade;
    expect(p).toMatchObject({ base: 23, acertos: 13 });
    expect(p?.acoes).toHaveLength(10);
    expect(p?.acoes[0]).toMatchObject({ texto: 'Alugar andaime', concluidaDia: null, du: 9 });
    expect(p?.acoes[1]).toMatchObject({
      texto: 'Começar infra de ar-condicionado',
      prazo: '2026-10-22',
      replanejamentos: 4,
    });
    expect(p?.simulacao?.quantas).toBe(3);
    expect(p?.simulacao?.score).toBeGreaterThan(a.score as number);
  });

  it('resposta ao atraso: atrasos em ordem para a conta da mediana', () => {
    const r = a.indicadores.respostaAtraso;
    expect(r?.atrasos).toEqual([1, 1, 2, 2, 2, 3, 4, 4, 8, 9]);
    expect(r?.simulacao?.score).toBeGreaterThan(a.score as number);
  });

  it('replanejamentos e abertas vencidas para fazer hoje', () => {
    expect(a.indicadores.replanejamentos?.acoes.map((x) => x.replanejamentos)).toEqual([4, 1]);
    expect(a.vencidasAbertas.map((x) => x.texto)).toEqual(['Alugar andaime', 'Cobrar ART']);
    expect(a.indicadores.pendencias).toBeUndefined();
  });

  it('sem o mínimo de ações, não há score nem simulação', () => {
    const b = analisarScoreEquipe(itens.slice(0, 3), 'thaina', 30, HOJE);
    expect(b.score).toBeNull();
    expect(b.indicadores.pontualidade?.simulacao).toBeNull();
  });
});

describe('analisarScorePrestador', () => {
  it('no fim previsto, atraso médio e foto', () => {
    const at = (p: Partial<ItemPrestador>): ItemPrestador => ({
      id: `a${++seq}`,
      obraId: 'o1',
      obraNome: 'CDC - Betim',
      texto: `Atividade ${seq}`,
      prestador: 'Pinturas Silva',
      fimPrevisto: '2026-11-03',
      concluidaEm: '2026-11-03T15:00:00',
      comFoto: true,
      excluida: false,
      ...p,
    });
    const itens = [
      at({}),
      at({}),
      at({ comFoto: false }),
      at({ concluidaEm: '2026-11-06T15:00:00' }),
      at({ concluidaEm: null, fimPrevisto: '2026-11-12' }),
    ];
    const a = analisarScorePrestador(itens, 'pinturas silva', 30, HOJE);
    expect(a.score).not.toBeNull();
    expect(a.indicadores.noFimPrevisto).toMatchObject({ base: 5, acertos: 3 });
    expect(a.indicadores.comFoto?.acoes).toHaveLength(1);
    expect(a.indicadores.atrasoMedio?.atrasos).toEqual([0, 0, 0, 3, 3]);
    expect(a.perdas.reduce((s, x) => s + x.perdidos, 0)).toBe(100 - (a.score as number));
  });
});
