import { describe, expect, it } from 'vitest';
import {
  formatosEmOrdem,
  colunasPreparoPessoa,
  limitesPreparo,
  preparoPorPessoa,
  textoBotaoPreparo,
  textoPreparoWhatsapp,
  totaisPreparo,
  type ObraPreparo,
} from './preparo';

const obra = (p: Partial<ObraPreparo> = {}): ObraPreparo => ({
  nome: 'CDC Ressaca',
  indicador: '47% · atrasada · 3 dias',
  atrasada: true,
  cobranca: [],
  previstos: [],
  semanaQueVem: [],
  providencias: [],
  ...p,
});

const ressaca = obra({
  cobranca: [
    {
      texto: 'Comprar tubos',
      pessoa: 'Marcos',
      prazo: 'até ter 03/11',
      atraso: false,
      data: '2026-11-03',
    },
    {
      texto: 'Concluir contrapiso · 50%',
      pessoa: 'Marcos',
      prazo: 'era 28/10',
      atraso: true,
      data: '2026-10-28',
    },
    {
      texto: 'Ligar para o síndico',
      pessoa: 'Sem responsável',
      prazo: 'até seg 02/11',
      atraso: false,
    },
  ],
  previstos: [{ texto: 'Terminar Hidráulica', prazo: 'fim qui 29/10', atraso: false }],
  semanaQueVem: [{ texto: 'Começar Emassamento', prazo: 'início qua 04/11', atraso: false }],
  providencias: [{ texto: 'Contratar pintor', prazo: 'na obra qua 04/11', atraso: false }],
});
const jf = obra({
  nome: 'CDC Juiz de Fora',
  indicador: '63% · no ritmo',
  atrasada: false,
  cobranca: [
    { texto: 'Contratar marceneiro', pessoa: 'Ana', prazo: 'até qua 04/11', atraso: false },
  ],
});

describe('preparar a reunião', () => {
  it('formatos na ordem fixa e texto do botão', () => {
    expect(formatosEmOrdem(['pessoa', 'tabela'])).toEqual(['tabela', 'pessoa']);
    expect(formatosEmOrdem(['contratado', 'pessoa', 'folha', 'tabela'])).toEqual([
      'tabela',
      'pessoa',
      'contratado',
      'folha',
    ]);
    expect(textoBotaoPreparo(0)).toBe('Marque um formato');
    expect(textoBotaoPreparo(1)).toBe('Baixar PDF');
    expect(textoBotaoPreparo(3)).toBe('Baixar PDF · 3 formatos');
  });

  it('totais', () => {
    expect(totaisPreparo([ressaca, jf])).toEqual({ cobrar: 4, atrasadas: 1, providencias: 1 });
  });

  it('por pessoa: em ordem, atrasadas primeiro, sem responsável no fim; providências sem dono', () => {
    const { pessoas, semDono } = preparoPorPessoa([ressaca, jf], '2026-11-02');
    expect(pessoas.map((p) => p.pessoa)).toEqual(['Ana', 'Marcos', 'Sem responsável']);
    expect(pessoas[1].itens[0]).toEqual({
      texto: 'Concluir contrapiso · 50% (CDC Ressaca)',
      prazo: 'era 28/10',
      atraso: true,
      data: '2026-10-28',
    });
    expect(semDono).toEqual([
      {
        texto: 'Contratar pintor (CDC Ressaca)',
        prazo: 'na obra qua 04/11',
        atraso: false,
        data: null,
      },
    ]);
  });

  it('WhatsApp', () => {
    const t = textoPreparoWhatsapp('seg 02/11', '16h', [ressaca, jf], '2026-10-31');
    expect(t).toContain('*CONTRO · Pauta da reunião*\n*seg 02/11 · 16h* · 2 obras');
    expect(t).toContain('4 ações a cobrar · 1 atrasada · 1 providência');
    expect(t).toContain('_🔴 atrasado · 🟡 vence em até 7 dias · 🔵 em dia_');
    expect(t).toContain('*🏗 CDC RESSACA*\n_47% · atrasada · 3 dias_');
    expect(t).toContain('*🔁 Cobrança*\n- 🟡 Comprar tubos · *Marcos* · até ter 03/11');
    expect(t).toContain('- 🔴 Concluir contrapiso · 50% · *Marcos* · era 28/10');
    expect(t).toContain('*📌 Previsto até a reunião*\n- 🔵 Terminar Hidráulica · fim qui 29/10');
    expect(t).toContain('*📅 Semana que vem*\n- 🔵 Começar Emassamento · início qua 04/11');
    expect(t).toContain('*🛒 Providências*\n- 🔵 Contratar pintor · na obra qua 04/11');
    expect(t).toContain('━━━━━━━━━━━━━━\n\n*🏗 CDC JUIZ DE FORA*');
    expect(t).not.toContain('; ');
  });
});

describe('colunas por pessoa na data da reunião', () => {
  const data = '2026-11-06'; // sexta: os limites incluem fins de semana
  const prazos = [
    '2026-11-22',
    '2026-11-21',
    '2026-11-12',
    '2026-11-11',
    '2026-11-07',
    data,
    '2026-11-05',
  ];
  const itens = prazos.map((d) => ({ texto: d, prazo: d, data: d, atraso: false }));

  it('classifica os limites inclusivos de hoje, +5 e +15 em dias corridos, ordenando por vencimento', () => {
    const c = colunasPreparoPessoa(itens, data);
    expect(c.atrasadas.map((i) => i.data)).toEqual(['2026-11-05']);
    expect(c.noDia.map((i) => i.data)).toEqual([data]);
    expect(c.ateCinco.map((i) => i.data)).toEqual(['2026-11-07', '2026-11-11']);
    expect(c.aposCinco.map((i) => i.data)).toEqual(['2026-11-12', '2026-11-21']);
    expect(itens[0].data).toBe('2026-11-22'); // não altera a entrada
  });

  it('filtra antes de contar e omite pessoas que só têm tarefas após 15 dias', () => {
    const r = preparoPorPessoa(
      [
        obra({
          cobranca: [
            ...itens.map((i) => ({ ...i, pessoa: 'Ana' })),
            { ...itens[0], pessoa: 'Bruno' },
          ],
          providencias: [itens[0], itens[1]],
        }),
      ],
      data,
    );
    expect(r.pessoas.map((p) => p.pessoa)).toEqual(['Ana']);
    expect(r.pessoas[0].itens).toHaveLength(6);
    expect(r.pessoas[0].itens[0].atraso).toBe(true); // ignora o atraso de hoje recebido
    expect(r.semDono.map((i) => i.data)).toEqual(['2026-11-21']);
  });

  it('não perde itens sem prazo e atravessa mês/ano corretamente', () => {
    const semPrazo = { texto: 'Definir prazo', prazo: 'sem prazo', data: null, atraso: false };
    expect(colunasPreparoPessoa([semPrazo], data).semPrazo).toEqual([semPrazo]);
    expect(limitesPreparo('2026-12-28')).toEqual({ cinco: '2027-01-02', quinze: '2027-01-12' });
  });
});
