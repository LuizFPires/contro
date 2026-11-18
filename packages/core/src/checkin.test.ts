import { describe, expect, it } from 'vitest';
import {
  aguardaGestor,
  checkinValido,
  distanciaMetros,
  frequenciaEm,
  lerFrequencia,
  montarFrequencia,
  textoFrequencia,
  ultimoDiaUtilDoMes,
  linhasCarimbo,
  presencaDaPessoa,
  segundaDa,
  situacaoLocal,
  textoDistancia,
  type PresencaObraEntrada,
} from './checkin';
import { calcularScoreEquipe, type ItemEquipe } from './score';
import { analisarScoreEquipe } from './scoreAnalise';

const OBRA = { lat: -19.9711, lng: -43.9634 };

describe('localização', () => {
  it('distância em metros (haversine)', () => {
    // ~0,01° de latitude ≈ 1.112 m
    expect(Math.round(distanciaMetros(OBRA, { lat: OBRA.lat + 0.01, lng: OBRA.lng }))).toBe(1112);
  });

  it('primeiro check-in vira o ponto; até 200 m é na obra; sem GPS precisa do Gestor', () => {
    expect(situacaoLocal(null, OBRA)).toEqual({ situacao: 'ponto', distancia: 0 });
    expect(situacaoLocal(OBRA, { lat: OBRA.lat + 0.001, lng: OBRA.lng }).situacao).toBe('na_obra');
    expect(situacaoLocal(OBRA, { lat: OBRA.lat + 0.01, lng: OBRA.lng })).toEqual({
      situacao: 'fora',
      distancia: 1112,
    });
    expect(situacaoLocal(OBRA, null)).toEqual({ situacao: 'sem_local', distancia: null });
  });

  it('fora ou sem local: aguarda o Gestor e só conta validado', () => {
    expect(aguardaGestor({ situacao: 'fora', validacao: null })).toBe(true);
    expect(checkinValido({ situacao: 'fora', validacao: null })).toBe(false);
    expect(checkinValido({ situacao: 'fora', validacao: 'validado' })).toBe(true);
    expect(checkinValido({ situacao: 'sem_local', validacao: 'nao_validado' })).toBe(false);
    expect(checkinValido({ situacao: 'na_obra', validacao: null })).toBe(true);
    expect(aguardaGestor({ situacao: 'na_obra', validacao: null })).toBe(false);
  });

  it('texto da distância', () => {
    expect(textoDistancia(347)).toBe('350 m');
    expect(textoDistancia(1212)).toBe('1,2 km');
  });
});

describe('frequência e presença', () => {
  it('frequência vigente pela data da mudança', () => {
    const h = [
      { desde: '2026-11-03', frequencia: '2/semana' as const },
      { desde: '2026-11-10', frequencia: '1/mes' as const },
    ];
    expect(frequenciaEm(h, '2026-11-02')).toBe('nao');
    expect(frequenciaEm(h, '2026-11-05')).toBe('2/semana');
    expect(frequenciaEm(h, '2026-11-12')).toBe('1/mes');
    expect(segundaDa('2026-11-15')).toBe('2026-11-09');
    expect(ultimoDiaUtilDoMes('2026-11-17')).toBe('2026-11-30');
    expect(ultimoDiaUtilDoMes('2026-10-05')).toBe('2026-10-30');
  });

  it('quantidade de 1 a 5 e período semanal ou mensal', () => {
    expect(lerFrequencia('3/semana')).toEqual({ quantidade: 3, periodo: 'semana' });
    expect(lerFrequencia('2/mes')).toEqual({ quantidade: 2, periodo: 'mes' });
    expect(lerFrequencia('nao')).toBeNull();
    expect(lerFrequencia('6/semana')).toBeNull();
    expect(montarFrequencia(4, 'mes')).toBe('4/mes');
    expect(montarFrequencia(null, 'semana')).toBe('nao');
    expect(textoFrequencia('1/mes')).toBe('1× por mês');
    expect(textoFrequencia('5/semana')).toBe('5× por semana');
    expect(textoFrequencia('nao')).toBe('não precisa');
  });

  const base = (p: Partial<PresencaObraEntrada>): PresencaObraEntrada => ({
    chavePessoa: 'jv',
    obraId: 'o1',
    obraNome: 'Ampliação CTN Buritis',
    frequencias: [{ desde: '2026-11-02', frequencia: '3/semana' }],
    dias: [],
    ...p,
  });

  it('por semana: semanas fechadas pedem N; a semana corrente só soma o feito', () => {
    const p = presencaDaPessoa(
      [
        base({
          // semana 02/11: 3 dias · semana 09/11: 1 dia · semana 16/11 (corrente): 1 dia
          dias: ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-11', '2026-11-16'],
        }),
      ],
      '2026-11-02',
      '2026-11-17',
    );
    expect(p.esperados).toBe(3 + 3 + 1);
    expect(p.feitos).toBe(3 + 1 + 1);
    expect(p.obras[0].faltas).toEqual([
      { periodo: 'semana', inicio: '2026-11-09', feitos: 1, pedidos: 3 },
    ]);
  });

  it('5 por semana cobre todos os dias úteis da semana fechada', () => {
    const p = presencaDaPessoa(
      [
        base({
          frequencias: [{ desde: '2026-11-09', frequencia: '5/semana' }],
          dias: ['2026-11-09'],
        }),
      ],
      '2026-11-09',
      '2026-11-17',
    );
    expect(p.esperados).toBe(5);
    expect(p.feitos).toBe(1);
  });

  it('por mês: mês fechado pede N; o mês corrente só soma o feito', () => {
    const p = presencaDaPessoa(
      [
        base({
          frequencias: [{ desde: '2026-10-01', frequencia: '2/mes' }],
          // outubro: 1 dia · novembro (corrente): 1 dia
          dias: ['2026-10-14', '2026-11-04'],
        }),
      ],
      '2026-10-01',
      '2026-11-17',
    );
    expect(p.esperados).toBe(2 + 1);
    expect(p.feitos).toBe(1 + 1);
    expect(p.obras[0].faltas).toEqual([
      { periodo: 'mes', inicio: '2026-10-01', feitos: 1, pedidos: 2 },
    ]);
  });

  it('janela que pega só o fim do mês pede no máximo os dias úteis dentro dela', () => {
    const p = presencaDaPessoa(
      [base({ frequencias: [{ desde: '2026-10-01', frequencia: '5/mes' }], dias: ['2026-10-30'] })],
      '2026-10-29',
      '2026-11-17',
    );
    // outubro na janela: 29 e 30 → pede 2, fez 1; novembro corrente sem check-in
    expect(p.esperados).toBe(2);
    expect(p.feitos).toBe(1);
  });

  it('"não precisa" não cobra; sem frequência, sem base', () => {
    const p = presencaDaPessoa(
      [base({ frequencias: [{ desde: '2026-11-02', frequencia: 'nao' }] })],
      '2026-11-02',
      '2026-11-17',
    );
    expect(p.nota).toBeNull();
    expect(presencaDaPessoa([], '2026-11-02', '2026-11-17').nota).toBeNull();
  });
});

describe('presença no Score', () => {
  let n = 0;
  const tarefa = (): ItemEquipe => ({
    id: `t${++n}`,
    origem: 'tarefa',
    obraId: 'o1',
    obraNome: 'Ampliação CTN Buritis',
    texto: `Tarefa ${n}`,
    chavePessoa: 'jv',
    nomePessoa: 'João Vitor',
    prazo: '2026-11-03',
    prazoOriginal: '2026-11-03',
    concluidaEm: '2026-11-03T15:00:00',
    replanejamentos: 0,
    excluida: false,
  });
  const itens = Array.from({ length: 5 }, tarefa);
  const pres: PresencaObraEntrada[] = [
    {
      chavePessoa: 'jv',
      obraId: 'o1',
      obraNome: 'Ampliação CTN Buritis',
      frequencias: [{ desde: '2026-11-09', frequencia: '5/semana' }],
      dias: ['2026-11-09', '2026-11-10'],
    },
  ];

  it('entra com peso 10 e o analisador mostra as faltas', () => {
    const [sem] = calcularScoreEquipe(itens, 30, '2026-11-17');
    const [com] = calcularScoreEquipe(itens, 30, '2026-11-17', pres);
    expect(sem.indicadores.presenca).toBeNull();
    expect(sem.score).toBe(100);
    // semana 09/11 fechada pede 5, fez 2; semana corrente sem check-in
    expect(com.indicadores.presenca).toBeCloseTo(2 / 5);
    expect(com.score).toBeLessThan(100);
    const a = analisarScoreEquipe(itens, 'jv', 30, '2026-11-17', pres);
    expect(a.indicadores.presenca?.presenca?.obras[0].faltas).toHaveLength(1);
    expect(a.indicadores.presenca?.simulacao?.score).toBe(100);
  });
});

describe('carimbo', () => {
  it('hora, data, obra e pessoa', () => {
    expect(
      linhasCarimbo('Ampliação CTN Buritis', 'Thaina C', new Date(2026, 10, 17, 16, 41)),
    ).toEqual(['16:41 · terça, 17/11/2026', 'Ampliação CTN Buritis · Thaina C']);
  });
});
