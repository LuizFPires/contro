import { describe, expect, it } from 'vitest';
import {
  contarRespondidos,
  deReuniaoAnterior,
  destinoNaAta,
  entraNaCobranca,
  montarObraAta,
  origemReuniao,
  respostaEfetiva,
  respostaPedeAcao,
  resumoReuniao,
  textoAtaWhatsapp,
  textosTotais,
  totaisAta,
  type ObraAtaEntrada,
} from './ata';

const entrada = (p: Partial<ObraAtaEntrada> = {}): ObraAtaEntrada => ({
  nome: p.nome ?? 'CDC Ressaca',
  indicador: p.indicador ?? '47% · atrasada 3 dias',
  atrasada: p.atrasada ?? true,
  situacao: p.situacao ?? 'Fase 3',
  itens: p.itens ?? [],
  acoes: p.acoes ?? [],
  cobranca: p.cobranca ?? [],
  observacoes: p.observacoes ?? '',
});

describe('respostas da pauta', () => {
  it('o segundo botão de cada seção pede ação', () => {
    expect(respostaPedeAcao('nao_terminou')).toBe(true);
    expect(respostaPedeAcao('nao_comecou')).toBe(true);
    expect(respostaPedeAcao('acao')).toBe(true);
    expect(respostaPedeAcao('nao_feita')).toBe(true);
    expect(respostaPedeAcao('terminou')).toBe(false);
    expect(respostaPedeAcao('segue')).toBe(false);
    expect(respostaPedeAcao('ja_providenciado')).toBe(false);
  });

  it('sem resposta gravada, vale o que o app já sabe', () => {
    expect(respostaEfetiva('passada_concluir', null, { concluida: true })).toBe('terminou');
    expect(respostaEfetiva('passada_comecar', null, { avancoPct: 25 })).toBe('comecou');
    expect(respostaEfetiva('passada_comecar', null, { avancoPct: 0 })).toBeNull();
    expect(respostaEfetiva('semana_concluir', null, { concluida: true })).toBeNull();
    // A resposta gravada sempre vence.
    expect(respostaEfetiva('passada_concluir', 'nao_terminou', { concluida: true })).toBe(
      'nao_terminou',
    );
  });

  it('"Na ata" diz para onde o item foi', () => {
    expect(destinoNaAta('passada_concluir', 'terminou')).toBe('Planejado e aconteceu');
    expect(destinoNaAta('passada_comecar', 'nao_comecou', 'Marcos')).toBe(
      'Planejado e não aconteceu · Quem faz o quê (Marcos)',
    );
    expect(destinoNaAta('semana_concluir', 'segue')).toBe('Próxima semana · segue o plano');
    expect(destinoNaAta('semana_comecar', 'acao', 'Ana')).toBe('Próxima semana · com ação (Ana)');
    expect(destinoNaAta('semana_providencia', 'ja_providenciado')).toBe(
      'Providências · já providenciado',
    );
    expect(destinoNaAta('cobranca', 'feita')).toBe('Cobrança · cumprida');
    expect(destinoNaAta('cobranca', 'nao_feita')).toBe('Cobrança · não cumprida, remarcada');
  });

  it('contador de respondidos', () => {
    expect(contarRespondidos(['terminou', null, 'segue'])).toEqual({ respondidos: 2, total: 3 });
  });
});

describe('montarObraAta', () => {
  const e = entrada({
    itens: [
      {
        id: 'a1',
        nome: 'Contrapiso',
        secao: 'passada_concluir',
        resposta: 'nao_terminou',
        avancoPct: 50,
      },
      { id: 'a2', nome: 'Piso vinílico', secao: 'passada_comecar', resposta: 'comecou' },
      {
        id: 'a3',
        nome: 'Hidráulica',
        secao: 'semana_concluir',
        resposta: 'segue',
        prestador: 'Hidro Silva',
      },
      { id: 'a4', nome: 'Forro', secao: 'semana_comecar', resposta: 'acao' },
      {
        id: 'p1',
        nome: 'Tubos e conexões',
        secao: 'semana_providencia',
        resposta: null,
        tipoProvidencia: 'compra',
        naObraEmFmt: 'qua 04/11',
      },
      {
        id: 'p2',
        nome: 'Caçamba',
        secao: 'semana_providencia',
        resposta: 'ja_providenciado',
        tipoProvidencia: 'locacao',
      },
    ],
    acoes: [
      { vinculoId: 'a1', texto: 'Concluir contrapiso', pessoa: 'Marcos', prazoFmt: 'qua 04/11' },
      { vinculoId: 'a4', texto: 'Confirmar gesseiro', pessoa: 'Ana', prazoFmt: 'ter 03/11' },
      { vinculoId: null, texto: 'Ligar para o síndico', pessoa: 'Ana', prazoFmt: 'seg 02/11' },
    ],
    cobranca: [
      {
        texto: 'Caçamba',
        pessoa: 'Marcos',
        feita: true,
        atrasada: false,
        prazoFmt: 'sex 30/10',
        replanejamentos: 0,
        avancoPct: 0,
      },
      {
        texto: 'Vidraceiro',
        pessoa: 'Ana',
        feita: false,
        atrasada: true,
        prazoFmt: 'qua 04/11',
        replanejamentos: 1,
        avancoPct: 50,
      },
    ],
    observacoes: '  Tapume entregue.  ',
  });
  const o = montarObraAta(e);

  it('semana passada: aconteceu e não aconteceu com a ação', () => {
    expect(o.aconteceu).toEqual([
      { texto: 'Piso vinílico · começou', acao: null, atraso: false, ok: true, semResposta: false },
    ]);
    expect(o.naoAconteceu[0]).toEqual({
      texto: 'Contrapiso · está em 50%',
      acao: 'Concluir contrapiso — Marcos, até qua 04/11',
      atraso: true,
      ok: false,
      semResposta: false,
    });
  });

  it('próxima semana: segue o plano com prestador e com ação', () => {
    expect(o.proximaSemana.map((l) => l.texto)).toEqual([
      'Terminar Hidráulica · segue o plano (Hidro Silva)',
      'Começar Forro',
    ]);
    expect(o.proximaSemana[1].acao).toBe('Confirmar gesseiro — Ana, até ter 03/11');
  });

  it('providências: sem resposta, já providenciado e ação avulsa', () => {
    expect(o.providencias.map((l) => l.texto)).toEqual([
      'Comprar Tubos e conexões (na obra qua 04/11) · sem resposta',
      'Alugar Caçamba · já providenciado',
      'Ligar para o síndico — Ana, até seg 02/11',
    ]);
    expect(o.providencias[0].semResposta).toBe(true);
  });

  it('cobrança: cumprida e remarcada com avanço', () => {
    expect(o.cobranca[0]).toMatchObject({ texto: 'Caçamba — Marcos', ok: true });
    expect(o.cobranca[1]).toMatchObject({
      texto: 'Vidraceiro — Ana · 50% feito · remarcada (1x), até qua 04/11',
      atraso: true,
      ok: false,
    });
    expect(o.observacoes).toBe('Tapume entregue.');
  });

  it('item da semana passada sem resposta', () => {
    const s = montarObraAta(
      entrada({ itens: [{ id: 'x', nome: 'Pintura', secao: 'passada_concluir', resposta: null }] }),
    );
    expect(s.naoAconteceu[0]).toMatchObject({ texto: 'Pintura · sem resposta', semResposta: true });
  });

  it('totais e textos do topo', () => {
    const t = totaisAta([e], [o]);
    expect(t).toEqual({
      aconteceram: 1,
      naoAconteceram: 1,
      semResposta: 1,
      acoesNovas: 3,
      cobrancaCumprida: 1,
      cobrancaTotal: 2,
    });
    expect(textosTotais(t)).toEqual([
      '1 aconteceu',
      '1 não aconteceu',
      '3 ações novas',
      'cobrança 1 de 2',
      '1 sem resposta',
    ]);
  });

  it('WhatsApp: blocos por obra, quem faz o quê e sem emoji', () => {
    const t = textoAtaWhatsapp(
      'segunda, 02/11/2026',
      '16h',
      [o],
      [
        {
          pessoa: 'Marcos',
          itens: [{ texto: 'qua 04/11 · Concluir contrapiso (CDC Ressaca)', atrasado: false }],
        },
      ],
    );
    expect(t).toContain('*CONTRO · Ata da semana*');
    expect(t).toContain('segunda, 02/11/2026 · 16h');
    expect(t).toContain('1 obra');
    expect(t).toContain('*CDC Ressaca* — 47% · atrasada 3 dias');
    expect(t).toContain('Aconteceu: Piso vinílico · começou');
    expect(t).toContain(
      'Não aconteceu: Contrapiso · está em 50% → Concluir contrapiso — Marcos, até qua 04/11',
    );
    expect(t).toContain('Cobrança: Caçamba — Marcos (cumprida);');
    expect(t).toContain('Obs: Tapume entregue.');
    expect(t).toContain('*Quem faz o quê*');
    expect(t).toContain('Marcos: qua 04/11 · Concluir contrapiso (CDC Ressaca)');
    expect(/\p{Emoji_Presentation}/u.test(t)).toBe(false);
  });
});

describe('cobrança e origem', () => {
  const atual = origemReuniao('seg 02/11');

  it('entra na cobrança: aberta, ou feita desde a reunião passada', () => {
    const t = (
      p: Partial<{ origem: string | null; concluido: boolean; feitaEm: string | null }>,
    ) => ({
      origem: 'Reunião seg 26/10',
      concluido: false,
      feitaEm: null,
      ...p,
    });
    expect(entraNaCobranca(t({}), atual, '2026-11-02')).toBe(true);
    expect(
      entraNaCobranca(t({ concluido: true, feitaEm: '2026-10-27T10:00:00Z' }), atual, '2026-11-02'),
    ).toBe(true);
    expect(
      entraNaCobranca(t({ concluido: true, feitaEm: '2026-10-20T10:00:00Z' }), atual, '2026-11-02'),
    ).toBe(false);
    expect(entraNaCobranca(t({ origem: atual }), atual, '2026-11-02')).toBe(false);
    expect(entraNaCobranca(t({ origem: null }), atual, '2026-11-02')).toBe(false);
  });

  it('conta cumpridas e atrasadas só das reuniões anteriores e as novas da atual', () => {
    const a = origemReuniao('26/10');
    const r = resumoReuniao(
      [
        { origem: 'Reunião 19/10', concluida: true, atrasada: false },
        { origem: 'Reunião 19/10', concluida: false, atrasada: true },
        { origem: 'Reunião 12/10', concluida: false, atrasada: true },
        { origem: 'Reunião 26/10', concluida: false, atrasada: false },
        { origem: null, concluida: true, atrasada: true },
      ],
      a,
    );
    expect(r).toEqual({ cumpridas: 1, atrasadas: 2, novas: 1 });
  });

  it('tarefa sem origem de reunião não é providência anterior', () => {
    const a = origemReuniao('26/10');
    expect(deReuniaoAnterior({ origem: null }, a)).toBe(false);
    expect(deReuniaoAnterior({ origem: 'Cronograma' }, a)).toBe(false);
    expect(deReuniaoAnterior({ origem: 'Reunião 26/10' }, a)).toBe(false);
    expect(deReuniaoAnterior({ origem: 'Reunião 19/10' }, a)).toBe(true);
  });
});
