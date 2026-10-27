import { describe, expect, it } from 'vitest';
import { agendaDoDia, resumoDoDia, type EntradaAgenda } from './agendaDia';

const INICIO = '2026-10-19'; // segunda
const HOJE = '2026-10-26'; // segunda seguinte: decorridos 5

function entrada(p: Partial<EntradaAgenda> = {}): EntradaAgenda {
  return {
    inicio: INICIO,
    hoje: HOJE,
    decorridos: 5,
    atividades: [
      // Mobilização: es 0, terminou sex 23/10 e não foi concluída → atrasada.
      {
        id: 'mob',
        nome: 'Mobilização',
        es: 0,
        inicio_previsto: '2026-10-19',
        fim_previsto: '2026-10-23',
        concluida: false,
        atrasada: true,
      },
      // Demolição: começa hoje (es 5).
      {
        id: 'dem',
        nome: 'Demolições',
        es: 5,
        inicio_previsto: '2026-10-26',
        fim_previsto: '2026-10-30',
        concluida: false,
        atrasada: false,
      },
      // Forro: termina hoje.
      {
        id: 'for',
        nome: 'Forro',
        es: 3,
        inicio_previsto: '2026-10-22',
        fim_previsto: '2026-10-26',
        concluida: false,
        atrasada: false,
      },
      // Pintura: futura, concluída fora de ordem não aparece.
      {
        id: 'pin',
        nome: 'Pintura',
        es: 10,
        inicio_previsto: '2026-11-02',
        fim_previsto: '2026-11-06',
        concluida: true,
        atrasada: false,
      },
    ],
    providencias: [
      // limite 5-3 = 2 (qua 21/10): passou → atraso.
      {
        id: 'p1',
        atividadeId: 'dem',
        tipo: 'locacao',
        descricao: 'Caçamba',
        status: 'pendente',
        antecedenciaDu: 3,
      },
      // limite 10-5 = 5 (hoje): para hoje.
      {
        id: 'p2',
        atividadeId: 'pin',
        tipo: 'compra',
        descricao: 'Tinta',
        status: 'pendente',
        antecedenciaDu: 5,
      },
      {
        id: 'p3',
        atividadeId: 'for',
        tipo: 'compra',
        descricao: 'Placas',
        status: 'feito',
        antecedenciaDu: 0,
      },
    ],
    tarefas: [
      { id: 't1', texto: 'Fechar o pintor', prazo: '2026-10-21', aberta: true, pessoa: 'Paulo' },
      { id: 't2', texto: 'Confirmar caçamba', prazo: HOJE, aberta: true, pessoa: 'Rafael' },
      { id: 't3', texto: 'Já feita', prazo: '2026-10-20', aberta: false, pessoa: 'Paulo' },
    ],
    ...p,
  };
}

describe('agendaDoDia', () => {
  it('atrasados: atividade, lembrete e tarefa vencidos, do mais antigo para o mais novo', () => {
    const { atrasados } = agendaDoDia(entrada());
    expect(atrasados.map((i) => [i.tipo, i.nome, i.data])).toEqual([
      ['locacao', 'Caçamba', '2026-10-21'],
      ['tarefa', 'Fechar o pintor', '2026-10-21'],
      ['concluir', 'Mobilização', '2026-10-23'],
    ]);
    expect(atrasados.every((i) => i.atraso)).toBe(true);
  });

  it('para hoje: concluir, começar, lembrete com prazo hoje e tarefa de hoje', () => {
    const { hoje } = agendaDoDia(entrada());
    expect(hoje.map((i) => [i.tipo, i.nome])).toEqual([
      ['concluir', 'Forro'],
      ['comecar', 'Demolições'],
      ['tarefa', 'Confirmar caçamba'],
    ]);
    expect(hoje.find((i) => i.tipo === 'tarefa')?.pessoa).toBe('Rafael');
  });

  it('lembrete que leva dias aparece desde o dia de começar até o prazo', () => {
    // Elétrica no dia 12; contratar 4 du antes (dia 8 = qui 29/10); leva 3 du.
    const ele = {
      id: 'ele',
      nome: 'Instalações elétricas',
      es: 12,
      inicio_previsto: '2026-11-04',
      fim_previsto: '2026-11-10',
      concluida: false,
      atrasada: false,
    };
    const prov = (duracaoDu: number) => ({
      id: 'pe',
      atividadeId: 'ele',
      tipo: 'contratacao' as const,
      descricao: 'Eletricista',
      status: 'pendente' as const,
      antecedenciaDu: 4,
      duracaoDu,
    });
    const com = (d: number, hoje = HOJE, decorridos = 5) =>
      agendaDoDia(entrada({ hoje, decorridos, atividades: [ele], providencias: [prov(d)] }));
    // Leva 3: começa no dia 5 (hoje, seg 26/10).
    expect(com(3).hoje.find((i) => i.nome === 'Eletricista')).toMatchObject({
      inicio: '2026-10-26',
      fim: '2026-10-29',
      atraso: false,
    });
    // Ter 27/10: ainda na lista, sem atraso.
    expect(com(3, '2026-10-27', 6).hoje.some((i) => i.nome === 'Eletricista')).toBe(true);
    // Leva 1: só começa qua 28/10, ainda não aparece hoje.
    expect(com(1).hoje.some((i) => i.nome === 'Eletricista')).toBe(false);
  });

  it('lembrete de atividade concluída não aparece; prazo hoje ainda não é atraso', () => {
    const e = entrada({
      atividades: entrada().atividades.map((a) =>
        a.id === 'pin' ? { ...a, concluida: false } : a,
      ),
    });
    const { hoje, atrasados } = agendaDoDia(e);
    expect(hoje.some((i) => i.nome === 'Tinta')).toBe(true);
    expect(atrasados.some((i) => i.nome === 'Tinta')).toBe(false);
  });

  it('o que devia ter começado e ainda está no prazo segue na lista (em andamento)', () => {
    const mapa = {
      id: 'mapa',
      nome: 'Mapa · Instalações elétricas',
      es: -12,
      inicio_previsto: '2026-10-21',
      fim_previsto: '2026-10-27',
      concluida: false,
      atrasada: false,
      libera: { nome: 'Instalações elétricas', inicio: '2026-11-10' },
    };
    const { hoje, atrasados } = agendaDoDia(
      entrada({ atividades: [...entrada().atividades, mapa] }),
    );
    const item = hoje.find((i) => i.chave === 'andamento-mapa');
    expect(item).toMatchObject({
      tipo: 'andamento',
      inicio: '2026-10-21',
      fim: '2026-10-27',
      libera: { nome: 'Instalações elétricas', inicio: '2026-11-10' },
    });
    expect(atrasados.some((i) => i.nome === mapa.nome)).toBe(false);
    // Ainda não começou: não aparece.
    const futuro = agendaDoDia(
      entrada({
        atividades: [{ ...mapa, inicio_previsto: '2026-10-27', fim_previsto: '2026-10-30' }],
      }),
    );
    expect(futuro.hoje.some((i) => i.nome === mapa.nome)).toBe(false);
  });
});

describe('resumoDoDia', () => {
  it('conta atrasos, coisas para hoje e obras com algo', () => {
    const a = agendaDoDia(entrada());
    expect(resumoDoDia([a, { atrasados: [], hoje: [] }])).toBe(
      '3 atrasos e 3 coisas para hoje em 1 obra',
    );
    expect(resumoDoDia([{ atrasados: [], hoje: [] }])).toBe(
      'Nada atrasado nem previsto para hoje.',
    );
  });
});
