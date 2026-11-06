import { describe, expect, it } from 'vitest';
import { textoBoletimWhatsapp } from './boletim';
import type { AtividadeGeral } from './obraGeral';
import {
  entraNaCobrancaGeral,
  montarBoletimGeral,
  providenciarAteGeral,
  semanaDaReuniaoGeral,
  situacaoProvidenciaGeral,
} from './obraGeralSemana';

let n = 0;
function ativ(p: Partial<AtividadeGeral>): AtividadeGeral {
  n += 1;
  return {
    id: `a${n}`,
    fase_id: 'f1',
    pai_id: null,
    ordem: n,
    nome: `Atividade ${n}`,
    data_prevista: null,
    data_prevista_original: null,
    replanejamentos: 0,
    responsavel_id: null,
    concluida_em: null,
    avanco_pct: 0,
    foto_conclusao_id: null,
    prestador: null,
    ...p,
  };
}

// Reunião na quarta 04/11/2026: semana 02/11-06/11, passada 26/10-30/10.
describe('semanaDaReuniaoGeral', () => {
  const noPrazo = ativ({ data_prevista: '2026-10-28', concluida_em: '2026-10-28T15:00:00' });
  const comAtraso = ativ({
    data_prevista: '2026-10-29',
    data_prevista_original: '2026-10-27',
    concluida_em: '2026-11-02T10:00:00',
  });
  const aberta = ativ({ data_prevista: '2026-10-30' });
  const daSemana = ativ({ data_prevista: '2026-11-05' });
  const futura = ativ({ data_prevista: '2026-11-10' });
  const semData = ativ({});
  const filha = ativ({ pai_id: 'outra', data_prevista: '2026-10-28' });
  const r = semanaDaReuniaoGeral({
    atividades: [noPrazo, comAtraso, aberta, daSemana, futura, semData, filha],
    dataReuniao: '2026-11-04',
    hoje: '2026-11-04',
  });

  it('separa a semana passada', () => {
    expect(r.passadaNoPrazo).toEqual([noPrazo]);
    expect(r.passadaComAtraso).toEqual([comAtraso]);
    expect(r.atrasadasAbertas).toEqual([aberta]);
  });
  it('cobra abertas atrasadas de semanas antigas e ignora as de antes ainda no prazo', () => {
    const antiga = ativ({ data_prevista: '2026-10-21' });
    const x = semanaDaReuniaoGeral({
      atividades: [antiga, aberta, daSemana],
      dataReuniao: '2026-11-04',
      hoje: '2026-11-04',
    });
    expect(x.atrasadasAbertas).toEqual([antiga, aberta]);
    expect(x.passadaNoPrazo).toEqual([]);
  });
  it('deriva o prazo dos subitens', () => {
    const pai = ativ({ data_prevista: '2026-10-20' });
    const sub = ativ({ pai_id: pai.id, data_prevista: '2026-11-05' });
    const x = semanaDaReuniaoGeral({
      atividades: [pai, sub],
      dataReuniao: '2026-11-04',
      hoje: '2026-11-04',
    });
    expect(x.daSemana).toEqual([pai]);
    expect(x.atrasadasAbertas).toEqual([]);
  });
  it('reunião no sábado usa a semana que termina nele', () => {
    const x = semanaDaReuniaoGeral({
      atividades: [daSemana, aberta],
      dataReuniao: '2026-11-07',
      hoje: '2026-11-07',
    });
    expect(x.daSemana).toEqual([daSemana]);
    expect(x.atrasadasAbertas).toEqual([aberta]);
  });
  it('lista esta semana e ignora subitens, futuras e sem data', () => {
    expect(r.daSemana).toEqual([daSemana]);
  });
});

describe('montarBoletimGeral', () => {
  const atividades = [
    ativ({ data_prevista: '2026-11-02', concluida_em: '2026-11-02T10:00:00' }),
    ativ({ nome: 'Atrasada', data_prevista: '2026-11-03' }),
    ativ({ nome: 'Sexta', data_prevista: '2026-11-06' }),
    ativ({ data_prevista: '2026-11-12' }),
  ];
  const b = montarBoletimGeral({
    obra: { nome: 'Loja Centro', cidade: 'Recife' },
    atividades,
    nomes: {},
    hoje: '2026-11-04',
    quemFazOQue: [],
  });

  it('calcula percentuais e listas', () => {
    expect(b.semanaFmt).toBe('seg 02/11 a sex 06/11');
    expect(b.realPct).toBe(0.25);
    expect(b.previstoSextaPct).toBe(0.75);
    expect(b.atrasos).toEqual(['Atrasada · era para ter 03/11']);
    expect(b.concluir.map((c) => c.nome)).toEqual(['Atrasada', 'Sexta']);
    expect(b.comecar).toEqual([]);
    expect(b.ritmoAtrasado).toBe(false);
  });
  it('gera o texto de WhatsApp com o nome da obra', () => {
    expect(textoBoletimWhatsapp(b, '2026-11-04')).toContain('LOJA CENTRO · RECIFE');
  });
  it('obra sem atividades não divide por zero', () => {
    const v = montarBoletimGeral({
      obra: { nome: 'X', cidade: null },
      atividades: [],
      nomes: {},
      hoje: '2026-11-04',
      quemFazOQue: [],
    });
    expect(v.realPct).toBe(0);
    expect(v.ritmoTexto).toBe('');
  });
});

describe('providenciarAteGeral', () => {
  it('3 d.u. antes de uma segunda cai na quarta anterior', () => {
    expect(providenciarAteGeral('2026-11-09', 3)).toBe('2026-11-04');
  });
  it('antecedência 0 é a própria data', () => {
    expect(providenciarAteGeral('2026-11-09', 0)).toBe('2026-11-09');
  });
});

describe('situacaoProvidenciaGeral', () => {
  const base = {
    status: 'pendente' as const,
    atividadeConcluida: false,
    prazoAtividade: '2026-11-09',
    antecedenciaDu: 3,
  };
  it('pendente antes do prazo: só a data limite', () => {
    expect(situacaoProvidenciaGeral({ ...base, hoje: '2026-11-03' })).toEqual({
      ate: '2026-11-04',
      atrasada: false,
      venceHoje: false,
    });
  });
  it('no dia do prazo vence hoje', () => {
    expect(situacaoProvidenciaGeral({ ...base, hoje: '2026-11-04' }).venceHoje).toBe(true);
  });
  it('passou do prazo e segue pendente: atrasada', () => {
    expect(situacaoProvidenciaGeral({ ...base, hoje: '2026-11-05' }).atrasada).toBe(true);
  });
  it('feita ou com a atividade concluída não atrasa', () => {
    expect(
      situacaoProvidenciaGeral({ ...base, status: 'feito', hoje: '2026-11-20' }).atrasada,
    ).toBe(false);
    expect(
      situacaoProvidenciaGeral({ ...base, atividadeConcluida: true, hoje: '2026-11-20' }).atrasada,
    ).toBe(false);
  });
  it('atividade sem data: sem prazo e sem atraso', () => {
    expect(situacaoProvidenciaGeral({ ...base, prazoAtividade: null, hoje: '2026-11-20' })).toEqual(
      { ate: null, atrasada: false, venceHoje: false },
    );
  });
});

// Reunião de qua 04/11/2026; a anterior foi qua 28/10.
describe('entraNaCobrancaGeral', () => {
  const atual = 'Reunião qua 04/11';
  const t = (p: { origem?: string | null; concluido?: boolean; feitaEm?: string | null }) => ({
    origem: p.origem ?? null,
    concluido: p.concluido ?? false,
    feitaEm: p.feitaEm ?? null,
  });

  it('cobra toda tarefa aberta da obra, venha ou não de reunião', () => {
    expect(entraNaCobrancaGeral(t({}), atual, '2026-11-04')).toBe(true);
    expect(entraNaCobrancaGeral(t({ origem: 'Reunião qua 28/10' }), atual, '2026-11-04')).toBe(
      true,
    );
  });

  it('não cobra a ação criada nesta reunião', () => {
    expect(entraNaCobrancaGeral(t({ origem: atual }), atual, '2026-11-04')).toBe(false);
  });

  it('mantém a feita depois da reunião anterior e tira a feita antes', () => {
    expect(
      entraNaCobrancaGeral(t({ concluido: true, feitaEm: '2026-11-02' }), atual, '2026-11-04'),
    ).toBe(true);
    expect(
      entraNaCobrancaGeral(t({ concluido: true, feitaEm: '2026-10-28' }), atual, '2026-11-04'),
    ).toBe(false);
    expect(entraNaCobrancaGeral(t({ concluido: true }), atual, '2026-11-04')).toBe(false);
  });
});
