import { describe, expect, it } from 'vitest';
import {
  avancoMedidoPct,
  barrasPorDia,
  comparativoAtividade,
  diaMedido,
  duInclusivo,
  erroPeriodo,
  formatarNumero,
  fracaoMedida,
  gradeDoMesDomingo,
  lerNumero,
  linhasPlanilhaComparativo,
  medicaoCompleta,
  metaDoDia,
  previstoAte,
  produtividade,
  referenciaLancamento,
  situacaoEm,
  sobrepoe,
  tabelaMeta,
  textoMetaWhatsApp,
  tituloMedicao,
  type Medicao,
  type Quantitativo,
} from './medicao';
import { passoMedicao } from './log';

// Exemplo do protótipo aprovado: piso vinílico, 1.200 m² em 10 d.u. (09/11 a 20/11).
const piso: Quantitativo = {
  total: 1200,
  unidade: 'm²',
  pessoas: 5,
  inicio: '2026-11-09',
  fim: '2026-11-20',
  du: 10,
};
const meds: Medicao[] = [
  { id: 'a', tipo: 'dia', de: '2026-11-09', ate: '2026-11-09', quantidade: 85, pessoas: 4 },
  { id: 'b', tipo: 'dia', de: '2026-11-10', ate: '2026-11-10', quantidade: 104, pessoas: 5 },
  { id: 'c', tipo: 'periodo', de: '2026-11-11', ate: '2026-11-12', quantidade: 236, pessoas: 5 },
  { id: 'd', tipo: 'dia', de: '2026-11-13', ate: '2026-11-13', quantidade: 131, pessoas: 6 },
];
const HOJE = '2026-11-16';

describe('quantitativo e avanço medido', () => {
  it('meta do dia = total ÷ dias úteis', () => {
    expect(metaDoDia(piso)).toBe(120);
  });
  it('conta dias úteis inclusos, sem fim de semana', () => {
    expect(duInclusivo('2026-11-12', '2026-11-16')).toBe(3);
    expect(duInclusivo('2026-11-16', '2026-11-16')).toBe(1);
    expect(duInclusivo('2026-11-17', '2026-11-16')).toBe(0);
  });
  it('avanço da atividade aberta vai de 0 a 99 (100 é concluir)', () => {
    expect(fracaoMedida(1200, meds)).toBeCloseTo(556 / 1200);
    expect(avancoMedidoPct(1200, meds)).toBe(46);
    expect(avancoMedidoPct(100, [{ ...meds[0], quantidade: 150 }])).toBe(99);
    expect(medicaoCompleta(100, [{ ...meds[0], quantidade: 100 }])).toBe(true);
    expect(medicaoCompleta(1200, meds)).toBe(false);
  });
  it('previsto conta os dias úteis antes do dia, dentro da atividade', () => {
    expect(previstoAte(piso, HOJE)).toBe(600);
    expect(previstoAte(piso, '2026-11-02')).toBe(0);
    expect(previstoAte(piso, '2026-12-01')).toBe(1200);
  });
});

describe('situação', () => {
  it('na ficha: atrasado com o medido até hoje', () => {
    const s = situacaoEm(piso, meds, HOJE);
    expect(s.real).toBe(556);
    expect(s.texto).toBe('Atrasado 44 m²');
    expect(s.tom).toBe('atraso');
  });
  it('no lançamento: só as medições antes do período', () => {
    const s = situacaoEm(piso, meds, '2026-11-11', { soAntes: true });
    expect(s.real).toBe(189);
    expect(s.tom).toBe('atraso');
  });
  it('antes do início previsto', () => {
    expect(situacaoEm(piso, [], '2026-10-26', { soAntes: true }).tom).toBe('planejada');
  });
  it('termina hoje e concluído', () => {
    const forro: Quantitativo = { ...piso, total: 650, du: 6, fim: HOJE };
    expect(situacaoEm(forro, [{ ...meds[0], quantidade: 545 }], HOJE).texto).toBe('Termina hoje');
    expect(situacaoEm(forro, [{ ...meds[0], quantidade: 650 }], HOJE).texto).toBe('Concluído');
  });
});

describe('referência do lançamento (meta e prazo)', () => {
  it('atrasada: precisa mais que a meta para recuperar', () => {
    const r = referenciaLancamento(piso, meds, HOJE, HOJE);
    expect(r.meta).toBe(120);
    expect(r.prazo).toBeCloseTo(128.8);
    expect(r.tom).toBe('recuperar');
    expect(r.titulo).toBe('Para recuperar o prazo');
    expect(r.detalhe).toBe(
      '128,8 m²/dia (8,8 acima da meta) · faltam 644 m² em 5 d.u. até sex 20/11',
    );
  });
  it('adiantada: pode fazer menos que a meta', () => {
    const pint: Quantitativo = { ...piso, total: 2400, du: 12, fim: '2026-11-24' };
    const r = referenciaLancamento(
      pint,
      [
        { ...meds[0], quantidade: 210 },
        { ...meds[1], quantidade: 225 },
      ],
      '2026-11-11',
      '2026-11-16',
    );
    expect(r.nDu).toBe(4);
    expect(r.meta).toBe(800);
    expect(r.tom).toBe('adiantada');
    expect(Math.round(r.prazo)).toBe(786);
  });
  it('ao editar, ignora a própria medição', () => {
    const r = referenciaLancamento(piso, meds, '2026-11-09', '2026-11-09', 'a');
    expect(r.tom).toBe('igual');
    expect(r.prazo).toBe(120);
  });
});

describe('período do lançamento', () => {
  it('não sobrepõe dias medidos (fora a medição editada)', () => {
    expect(sobrepoe(meds, '2026-11-12', '2026-11-16')).toBe(true);
    expect(sobrepoe(meds, '2026-11-11', '2026-11-12', 'c')).toBe(false);
    expect(diaMedido(meds, '2026-11-11')).toBe(true);
    expect(diaMedido(meds, '2026-11-16')).toBe(false);
  });
  it('libera qualquer data até hoje; recusa futuro e fim de semana', () => {
    expect(erroPeriodo(meds, '2026-10-26', '2026-10-28', HOJE)).toBeNull();
    expect(erroPeriodo(meds, '2026-11-16', '2026-11-17', HOJE)).toMatch(/até hoje/);
    expect(erroPeriodo(meds, '2026-11-14', '2026-11-16', HOJE)).toMatch(/dia útil/);
    expect(erroPeriodo(meds, '2026-11-12', '2026-11-16', HOJE)).toMatch(/já medidos/);
  });
  it('título da medição', () => {
    expect(tituloMedicao(meds[1])).toBe('Dia · ter 10/11');
    expect(tituloMedicao(meds[2])).toBe('qua 11/11 → qui 12/11');
  });
});

describe('produtividade nesta obra', () => {
  it('ritmo, pessoas, melhor e menor, e pessoas para a meta', () => {
    const p = produtividade(meds, 120);
    expect(p.dias).toBe(5);
    expect(p.ritmo).toBeCloseTo(111.2);
    expect(p.pessoasMedia).toBe(5);
    expect(p.porPessoa).toBeCloseTo(22.24);
    expect(p.melhor?.m.id).toBe('d');
    expect(p.menor?.m.id).toBe('a');
    expect(p.porPessoaMin).toBeCloseTo(20.8);
    expect(p.porPessoaMax).toBeCloseTo(23.6);
    expect(p.pessoasParaMeta).toBe(6);
    expect(p.bateramMeta).toBe(1);
    expect(p.linhas[2].porDia).toBe(118);
  });
  it('sem medição', () => {
    const p = produtividade([], 120);
    expect(p.ritmo).toBe(0);
    expect(p.melhor).toBeNull();
  });
});

describe('meta da atividade', () => {
  it('barras e tabela por dia útil, com a média do período', () => {
    const b = barrasPorDia(piso, meds, HOJE);
    expect(b).toHaveLength(10);
    expect(b[2]).toMatchObject({ dia: '2026-11-11', real: 118, periodo: true });
    expect(b[5]).toMatchObject({ dia: HOJE, real: null, hoje: true });
    const t = tabelaMeta(piso, meds, HOJE);
    expect(t[4].acumulado).toBe(600);
  });
  it('sem pessoas previstas, a meta sai sem o número de pessoas', () => {
    const txt = textoMetaWhatsApp({
      obra: 'CDC Exemplo',
      numero: 39,
      atividade: 'Piso vinílico',
      prestador: null,
      q: { ...piso, pessoas: null },
      meds,
      hoje: HOJE,
    });
    expect(txt.split('\n').slice(2, 5)).toEqual([
      '#39 Piso vinílico · sem prestador',
      '',
      'Meta 120 m²/dia',
    ]);
  });
  it('texto do WhatsApp só da atividade, próximos 5 dias úteis', () => {
    const txt = textoMetaWhatsApp({
      obra: 'CDC Exemplo',
      numero: 39,
      atividade: 'Piso vinílico',
      prestador: 'Joaquim',
      q: piso,
      meds,
      hoje: HOJE,
    });
    expect(txt.split('\n')).toEqual([
      '*CONTRO · Meta*',
      'CDC Exemplo',
      '#39 Piso vinílico · Joaquim',
      '',
      'Meta 120 m²/dia com 5 pessoas',
      'seg 16/11: 120 m² (acum. 720)',
      'ter 17/11: 120 m² (acum. 840)',
      'qua 18/11: 120 m² (acum. 960)',
      'qui 19/11: 120 m² (acum. 1.080)',
      'sex 20/11: 120 m² (acum. 1.200)',
    ]);
  });
});

describe('comparativo da mesma atividade entre obras', () => {
  const linha = (
    obraId: string,
    prestador: string,
    quantidade: number,
    de: string,
    ate: string,
    pessoas = 4,
  ) => ({
    obraId,
    obra: `Obra ${obraId}`,
    prestador,
    m: { id: `${obraId}${de}`, tipo: 'periodo' as const, de, ate, quantidade, pessoas },
  });
  const c = comparativoAtividade(
    [
      linha('n', 'João Gesso', 700, '2026-09-01', '2026-09-09'),
      linha('s', 'João Gesso', 620, '2026-07-01', '2026-07-08'),
      linha('l', 'Gesso Minas', 640, '2026-05-04', '2026-05-13'),
      linha('c', 'João Gesso', 520, '2026-11-09', '2026-11-13'),
    ],
    'c',
  );
  it('por obra, do maior ritmo ao menor, com a obra atual marcada', () => {
    expect(c.obras).toBe(4);
    expect(c.prestadores).toBe(2);
    expect(c.porObra.map((l) => l.obraId)).toEqual(['c', 's', 'n', 'l']);
    expect(c.porObra[0].estaObra).toBe(true);
    expect(c.porObra[0].porDia).toBe(104);
  });
  it('por prestador', () => {
    expect(c.porPrestador.map((p) => p.prestador)).toEqual(['João Gesso', 'Gesso Minas']);
    expect(c.porPrestador[1].porDia).toBe(80);
  });
  it('planilha com cabeçalho e números no padrão brasileiro', () => {
    const l = linhasPlanilhaComparativo(c, 'm²');
    expect(l[0][5]).toBe('m²/dia');
    expect(l[1]).toEqual(['Obra c', 'João Gesso', '520', '5', '4', '104', '26', '1', 'sex 13/11']);
  });
});

describe('formatos', () => {
  it('número brasileiro e leitura do digitado', () => {
    expect(formatarNumero(1234.56, 2)).toBe('1.234,56');
    expect(formatarNumero(120, 1)).toBe('120');
    expect(formatarNumero(128.8, 1)).toBe('128,8');
    expect(lerNumero('1.200')).toBe(1200);
    expect(lerNumero('95,5')).toBe(95.5);
    expect(lerNumero('1.234,5')).toBe(1234.5);
    expect(lerNumero('12.5')).toBe(12.5);
    expect(lerNumero('abc')).toBe(0);
  });
  it('grade do mês começa no domingo', () => {
    const g = gradeDoMesDomingo(2026, 11);
    expect(g[0]).toBe('2026-11-01');
    expect(g).toHaveLength(30);
    const out = gradeDoMesDomingo(2026, 10);
    expect(out.slice(0, 5)).toEqual([null, null, null, null, '2026-10-01']);
  });
});

describe('vida da atividade', () => {
  const ev = (
    tipo: string,
    depois: Record<string, unknown>,
    antes: Record<string, unknown> | null = null,
  ) => ({
    id: tipo,
    itemId: 'x',
    tipo,
    por: null,
    porNome: 'Rafael Souza',
    em: '2026-11-16T12:00:00Z',
    antes,
    depois,
  });
  it('medição lançada e ajustada abrem para editar', () => {
    const p = passoMedicao(
      ev('medicao', {
        medicao_id: 'm1',
        de: '2026-11-11',
        ate: '2026-11-12',
        unidade: 'm²',
        quantidade: 236,
        pessoas: 5,
      }),
    );
    expect(p).toMatchObject({
      rotulo: 'Avanço medido',
      detalhe: '+236 m² de qua 11/11 a qui 12/11 · 5 pessoas',
      medicaoId: 'm1',
    });
    const e = passoMedicao(
      ev(
        'medicao_editada',
        {
          medicao_id: 'm1',
          de: '2026-11-10',
          ate: '2026-11-10',
          unidade: 'm²',
          quantidade: 95,
          pessoas: 5,
        },
        { quantidade: 110 },
      ),
    );
    expect(e?.detalhe).toBe('de 110 para 95 m² no dia ter 10/11 · 5 pessoas');
  });
  it('quantitativo definido; outros eventos não são de medição', () => {
    expect(
      passoMedicao(ev('quantitativo', { total: 1200, unidade: 'm²', pessoas: 5 }))?.detalhe,
    ).toBe('1.200 m² · 5 pessoas previstas');
    expect(passoMedicao(ev('avanco', { pct: 50 }))).toBeNull();
  });
});
