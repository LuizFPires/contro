import { describe, expect, it } from 'vitest';
import {
  calcularScoreEquipe,
  calcularScorePrestadores,
  MINIMO_ITENS,
  PESOS_EQUIPE,
  PESOS_PRESTADOR,
  rotuloFaixa,
  tendencia,
  type ItemEquipe,
  type ItemPrestador,
} from './score';

// Hoje é quarta, 04/11/2026. Janela de 30 dias: 06/10 a 04/11.
const HOJE = '2026-11-04';

let seq = 0;
function tarefa(p: Partial<ItemEquipe> = {}): ItemEquipe {
  seq += 1;
  return {
    id: `t${seq}`,
    origem: 'tarefa',
    obraId: 'o1',
    obraNome: 'Savassi',
    texto: `Tarefa ${seq}`,
    chavePessoa: 'p1',
    nomePessoa: 'Matheus Teófilo',
    prazo: '2026-10-28',
    prazoOriginal: '2026-10-28',
    concluidaEm: '2026-10-28T15:00:00',
    replanejamentos: 0,
    excluida: false,
    ...p,
  };
}

function atividade(p: Partial<ItemPrestador> = {}): ItemPrestador {
  seq += 1;
  return {
    id: `a${seq}`,
    obraId: 'o1',
    obraNome: 'Savassi',
    texto: `Atividade ${seq}`,
    prestador: 'Pinturas Silva',
    fimPrevisto: '2026-10-28',
    concluidaEm: '2026-10-28T15:00:00',
    comFoto: true,
    excluida: false,
    ...p,
  };
}

function cinco<T>(f: () => T): T[] {
  return Array.from({ length: 5 }, f);
}

describe('pesos', () => {
  it('somam 100 e o mínimo é 5 itens', () => {
    expect(Object.values(PESOS_EQUIPE).reduce((a, b) => a + b, 0)).toBe(100);
    expect(Object.values(PESOS_PRESTADOR).reduce((a, b) => a + b, 0)).toBe(100);
    expect(MINIMO_ITENS).toBe(5);
  });
});

describe('calcularScoreEquipe', () => {
  it('tarefa replanejada 2× e concluída no 3º prazo: atrasada pelo original, em dia pelo vigente (Review Focus 1)', () => {
    // prazo original seg 26/10; replanejada duas vezes até sex 30/10; concluída na sex 30/10.
    const [linha] = calcularScoreEquipe(
      [
        tarefa({
          prazoOriginal: '2026-10-26',
          prazo: '2026-10-30',
          concluidaEm: '2026-10-30T17:00:00',
          replanejamentos: 2,
        }),
      ],
      30,
      HOJE,
    );
    expect(linha.indicadores.pontualidade).toBe(0);
    expect(linha.indicadores.conclusaoDoDia).toBe(1);
    // 26/10 → 30/10 = 4 d.u. de atraso → nota 1 − 4/5
    expect(linha.indicadores.respostaAtraso).toBeCloseTo(0.2);
    expect(linha.indicadores.replanejamentos).toBe(0);
    expect(linha.indicadores.pendencias).toBeNull();
    expect(linha.piores[0].detalhe).toBe('4 d.u. de atraso · 2 replanejamentos');
  });

  it('prazo no sábado e concluída na segunda conta 1 d.u. de atraso (Review Focus 2)', () => {
    const [linha] = calcularScoreEquipe(
      [
        tarefa({
          prazoOriginal: '2026-10-31',
          prazo: '2026-10-31',
          concluidaEm: '2026-11-02T09:00:00',
        }),
      ],
      30,
      HOJE,
    );
    expect(linha.indicadores.pontualidade).toBe(0);
    // mediana 1 → nota 1 − 1/5
    expect(linha.indicadores.respostaAtraso).toBeCloseTo(0.8);
    expect(linha.piores[0].detalhe).toBe('1 d.u. de atraso');
  });

  it('prazo no sábado e concluída no domingo também conta 1 d.u. (piso de 1 para quem passou do prazo)', () => {
    const [linha] = calcularScoreEquipe(
      [
        tarefa({
          prazoOriginal: '2026-10-31',
          prazo: '2026-10-31',
          concluidaEm: '2026-11-01T10:00:00',
        }),
      ],
      30,
      HOJE,
    );
    expect(linha.indicadores.pontualidade).toBe(0);
    expect(linha.piores[0].detalhe).toBe('1 d.u. de atraso');
  });

  it('conclusão do dia: antes do prazo vigente acerta; 1 d.u. depois erra, mesmo replanejada', () => {
    const [linha] = calcularScoreEquipe(
      [
        // prazo sex 30/10, concluída antes, na qua 28/10: acerto
        tarefa({
          prazoOriginal: '2026-10-30',
          prazo: '2026-10-30',
          concluidaEm: '2026-10-28T10:00:00',
        }),
        // replanejada de 26/10 para qui 29/10, concluída na sex 30/10: erro
        tarefa({
          prazoOriginal: '2026-10-26',
          prazo: '2026-10-29',
          concluidaEm: '2026-10-30T10:00:00',
          replanejamentos: 1,
        }),
      ],
      30,
      HOJE,
    );
    expect(linha.indicadores.conclusaoDoDia).toBeCloseTo(0.5);
  });

  it('pessoa com 4 itens fica sem score e depois das pontuadas (Review Focus 3)', () => {
    const linhas = calcularScoreEquipe(
      [
        ...Array.from({ length: 4 }, () => tarefa({ chavePessoa: 'p2', nomePessoa: 'Ana Souza' })),
        ...cinco(() =>
          tarefa({
            chavePessoa: 'p3',
            nomePessoa: 'Zeca Lima',
            prazoOriginal: '2026-10-20',
            prazo: '2026-10-20',
            concluidaEm: '2026-10-30T10:00:00',
          }),
        ),
      ],
      30,
      HOJE,
    );
    expect(linhas.map((l) => l.chave)).toEqual(['p3', 'p2']);
    expect(linhas[1].itens).toBe(4);
    expect(linhas[1].score).toBeNull();
    expect(linhas[1].faixa).toBe('sem_score');
    expect(linhas[0].score).not.toBeNull();
  });

  it('5 itens no prazo: score 100 e faixa resolutivo; indicadores sem base ficam nulos', () => {
    const [linha] = calcularScoreEquipe(
      cinco(() => tarefa()),
      30,
      HOJE,
    );
    expect(linha.itens).toBe(5);
    expect(linha.indicadores.respostaAtraso).toBeNull(); // ninguém atrasou
    expect(linha.indicadores.pendencias).toBeNull(); // nenhuma pendência
    expect(linha.score).toBe(100);
    expect(linha.faixa).toBe('resolutivo');
    expect(linha.piores).toEqual([]);
  });

  it('redistribui o peso proporcionalmente entre os indicadores com base', () => {
    // 5 tarefas no prazo, concluídas no dia, com 1 replanejamento cada (nota 0,5).
    // Sem atraso e sem pendência: pesos 35 + 20 + 15 = 70.
    // score = (35×1 + 20×1 + 15×0,5) / 70 × 100 = 89,28… → 89
    const [linha] = calcularScoreEquipe(
      cinco(() => tarefa({ replanejamentos: 1 })),
      30,
      HOJE,
    );
    expect(linha.indicadores.replanejamentos).toBeCloseTo(0.5);
    expect(linha.score).toBe(89);
  });

  it('aberto e vencido conta como não pontual e mede atraso até hoje', () => {
    // vencida na seg 26/10, ainda aberta: 26/10 → 04/11 = 7 d.u.
    const [linha] = calcularScoreEquipe(
      [tarefa({ prazoOriginal: '2026-10-26', prazo: '2026-10-26', concluidaEm: null })],
      30,
      HOJE,
    );
    expect(linha.itens).toBe(1);
    expect(linha.indicadores.pontualidade).toBe(0);
    expect(linha.indicadores.conclusaoDoDia).toBe(0);
    expect(linha.indicadores.respostaAtraso).toBe(0);
    expect(linha.piores[0].detalhe).toBe('7 d.u. de atraso');
  });

  it('ignora abertos no prazo, excluídos e itens fora da janela', () => {
    const linhas = calcularScoreEquipe(
      [
        tarefa({ prazoOriginal: '2026-11-06', prazo: '2026-11-06', concluidaEm: null }),
        tarefa({ prazoOriginal: HOJE, prazo: HOJE, concluidaEm: null }),
        tarefa({ excluida: true }),
        tarefa({
          prazoOriginal: '2026-09-01',
          prazo: '2026-09-01',
          concluidaEm: '2026-09-01T10:00:00',
        }),
        tarefa({ prazoOriginal: '2026-09-01', prazo: '2026-09-01', concluidaEm: null }),
      ],
      30,
      HOJE,
    );
    expect(linhas).toEqual([]);
  });

  it('janela de 90 dias inclui o que a de 30 deixa de fora', () => {
    const itens = [
      tarefa({
        prazoOriginal: '2026-09-01',
        prazo: '2026-09-01',
        concluidaEm: '2026-09-01T10:00:00',
      }),
    ];
    expect(calcularScoreEquipe(itens, 30, HOJE)).toEqual([]);
    expect(calcularScoreEquipe(itens, 90, HOJE)[0].itens).toBe(1);
  });

  it('janela começa em hoje − (janela − 1) dias', () => {
    const noLimite = tarefa({
      prazoOriginal: '2026-10-06',
      prazo: '2026-10-06',
      concluidaEm: '2026-10-06T10:00:00',
    });
    const antes = tarefa({
      prazoOriginal: '2026-10-05',
      prazo: '2026-10-05',
      concluidaEm: '2026-10-05T10:00:00',
    });
    expect(calcularScoreEquipe([noLimite, antes], 30, HOJE)[0].itens).toBe(1);
  });

  it('pendências: % resolvidas no prazo', () => {
    const [linha] = calcularScoreEquipe(
      [
        tarefa({ origem: 'pendencia' }),
        tarefa({ origem: 'pendencia', prazoOriginal: '2026-10-27', prazo: '2026-10-27' }),
      ],
      30,
      HOJE,
    );
    expect(linha.indicadores.pendencias).toBeCloseTo(0.5);
    expect(linha.indicadores.replanejamentos).toBeNull(); // nenhuma tarefa
  });

  it('mediana do atraso e as 3 ações que mais pesaram, com o nome da obra', () => {
    const [linha] = calcularScoreEquipe(
      [
        tarefa({ prazoOriginal: '2026-10-27', concluidaEm: '2026-10-28T10:00:00' }), // 1
        tarefa({ prazoOriginal: '2026-10-26', concluidaEm: '2026-10-28T10:00:00' }), // 2
        tarefa({
          prazoOriginal: '2026-10-22',
          concluidaEm: '2026-10-28T10:00:00',
          obraId: 'o2',
          obraNome: 'Lourdes',
        }), // 4
        tarefa({ prazoOriginal: '2026-10-21', concluidaEm: '2026-10-28T10:00:00' }), // 5
        tarefa(),
      ],
      30,
      HOJE,
    );
    expect(linha.indicadores.respostaAtraso).toBeCloseTo(1 - 3 / 5); // mediana de 1,2,4,5 = 3
    expect(linha.numeros.respostaMedianaDU).toBe(3);
    expect(linha.numeros.atrasoMedioDU).toBeCloseTo(12 / 5); // (1 + 2 + 4 + 5 + 0) / 5
    expect(linha.numeros.replanejamentosMedia).toBe(0);
    expect(linha.numeros.obras).toBe(2);
    expect(linha.piores.map((p) => p.detalhe)).toEqual([
      '5 d.u. de atraso',
      '4 d.u. de atraso',
      '2 d.u. de atraso',
    ]);
    expect(linha.piores[1].obraNome).toBe('Lourdes');
  });

  it('ordena por score desc e depois por nome; sem score por último', () => {
    const atrasada = {
      prazoOriginal: '2026-10-20',
      prazo: '2026-10-20',
      concluidaEm: '2026-10-30T10:00:00',
    };
    const linhas = calcularScoreEquipe(
      [
        ...cinco(() => tarefa({ chavePessoa: 'b', nomePessoa: 'Bruno', ...atrasada })),
        ...cinco(() => tarefa({ chavePessoa: 'c', nomePessoa: 'Carla' })),
        ...cinco(() => tarefa({ chavePessoa: 'a', nomePessoa: 'Álvaro' })),
        ...Array.from({ length: 2 }, () => tarefa({ chavePessoa: 'z', nomePessoa: 'Aécio' })),
      ],
      30,
      HOJE,
    );
    expect(linhas.map((l) => l.nome)).toEqual(['Álvaro', 'Carla', 'Bruno', 'Aécio']);
    expect(linhas[2].faixa).toBe('atencao');
  });
});

describe('calcularScorePrestadores', () => {
  it('agrupa pelo nome normalizado, exibe a grafia mais frequente e ignora prestador em branco', () => {
    const linhas = calcularScorePrestadores(
      [
        atividade({ prestador: 'Pinturas Silva' }),
        atividade({ prestador: 'pinturas silva ' }),
        atividade({ prestador: 'Pinturas Sílva' }),
        atividade({ prestador: 'Pinturas Silva' }),
        atividade({ prestador: 'Pinturas Silva' }),
        atividade({ prestador: '   ' }),
      ],
      30,
      HOJE,
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].chave).toBe('pinturas silva');
    expect(linhas[0].nome).toBe('Pinturas Silva');
    expect(linhas[0].itens).toBe(5);
    expect(linhas[0].score).toBe(100);
    expect(linhas[0].faixa).toBe('em_dia');
  });

  it('foto anexada depois da conclusão conta em "Com foto" (Review Focus 4)', () => {
    // o adaptador marca comFoto = true quando há o evento foto_anexada
    const [linha] = calcularScorePrestadores(
      [
        atividade({ comFoto: false }),
        atividade({ comFoto: true }),
        atividade({ comFoto: true }),
        atividade({ comFoto: true }),
      ],
      30,
      HOJE,
    );
    expect(linha.indicadores.comFoto).toBeCloseTo(0.75);
  });

  it('no fim previsto, atraso médio e vencidas abertas', () => {
    const [linha] = calcularScorePrestadores(
      [
        atividade(), // no prazo
        atividade({ fimPrevisto: '2026-10-26', concluidaEm: '2026-10-28T10:00:00' }), // 2 d.u.
        atividade({ fimPrevisto: '2026-10-28', concluidaEm: null }), // aberta: 28/10 → 04/11 = 5 d.u.
        atividade({
          fimPrevisto: '2026-10-31',
          concluidaEm: '2026-11-02T10:00:00',
          comFoto: false,
        }), // sáb → seg: 1 d.u.
        atividade({ fimPrevisto: '2026-11-09', concluidaEm: null }), // aberta no prazo: fora
      ],
      30,
      HOJE,
    );
    expect(linha.itens).toBe(4);
    expect(linha.indicadores.noFimPrevisto).toBeCloseTo(0.25);
    // média (0 + 2 + 5 + 1) / 4 = 2 → nota 1 − 2/5
    expect(linha.indicadores.atrasoMedio).toBeCloseTo(0.6);
    expect(linha.numeros.atrasoMedioDU).toBe(2);
    expect(linha.numeros.respostaMedianaDU).toBeNull();
    expect(linha.numeros.obras).toBe(1);
    expect(linha.indicadores.comFoto).toBeCloseTo(2 / 3);
    expect(linha.score).toBeNull();
    expect(linha.faixa).toBe('sem_score');
    expect(linha.piores.map((p) => p.detalhe)).toEqual([
      '5 d.u. de atraso',
      '2 d.u. de atraso',
      '1 d.u. de atraso',
    ]);
  });

  it('faixa regular entre 50 e 74', () => {
    // 3 no prazo sem foto e 2 com 1 d.u. com foto: fim 0,6; atraso médio 0,4 → 0,92; foto 0,4
    // 45×0,6 + 30×0,92 + 25×0,4 = 27 + 27,6 + 10 = 64,6 → 65
    const [linha] = calcularScorePrestadores(
      [
        atividade({ comFoto: false }),
        atividade({ comFoto: false }),
        atividade({ comFoto: false }),
        atividade({ fimPrevisto: '2026-10-27' }),
        atividade({ fimPrevisto: '2026-10-27' }),
      ],
      30,
      HOJE,
    );
    expect(linha.score).toBe(65);
    expect(linha.faixa).toBe('regular');
  });
});

describe('tendencia', () => {
  it('compara 30 com 90 dias com folga de 5 pontos', () => {
    expect(tendencia(41, 37)).toBe('estavel');
    expect(tendencia(60, 50)).toBe('melhorando');
    expect(tendencia(55, 50)).toBe('melhorando');
    expect(tendencia(45, 50)).toBe('piorando');
    expect(tendencia(null, 50)).toBeNull();
    expect(tendencia(50, null)).toBeNull();
  });
});

describe('rotuloFaixa', () => {
  it('rótulos em pt-BR, com gênero para resolutivo', () => {
    expect(rotuloFaixa('resolutivo', 'f')).toBe('Resolutiva');
    expect(rotuloFaixa('resolutivo', 'm')).toBe('Resolutivo');
    expect(rotuloFaixa('resolutivo')).toBe('Resolutivo');
    expect(rotuloFaixa('em_dia')).toBe('Em dia');
    expect(rotuloFaixa('regular')).toBe('Regular');
    expect(rotuloFaixa('atencao')).toBe('Atenção');
    expect(rotuloFaixa('sem_score')).toBe('Sem score ainda');
  });
});
