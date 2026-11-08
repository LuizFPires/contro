import { describe, expect, it } from 'vitest';
import {
  compararRevisoes,
  evolucaoNota,
  formatarEvolucao,
  itemCongelado,
  faltamParaFechar,
  formatarNota,
  notaAoResolver,
  notaAvaliacao,
  pctOficial,
  previaNovaRevisao,
  resumoSecoes,
  situacaoItem,
  tirandoPonto,
  type ItemAvaliacao,
} from './avaliacao';

function item(p: Partial<ItemAvaliacao> & { id: string }): ItemAvaliacao {
  return {
    modeloItemId: p.id,
    secaoOrdem: 1,
    secao: 'Recepção',
    ordem: 1,
    codigo: null,
    nome: p.id,
    pontos: 10,
    resultado: null,
    reconfirmar: false,
    pendenciaStatus: null,
    ...p,
  };
}

describe('situacaoItem', () => {
  it('sem resposta: a avaliar ou a reconfirmar', () => {
    expect(situacaoItem(item({ id: 'a' }))).toBe('a_avaliar');
    expect(situacaoItem(item({ id: 'a', reconfirmar: true }))).toBe('a_reconfirmar');
  });
  it('não conforme segue a pendência do Check list', () => {
    const nc = { id: 'a', resultado: 'nao_conforme' as const };
    expect(situacaoItem(item({ ...nc, pendenciaStatus: 'aberta' }))).toBe('nao_conforme');
    expect(situacaoItem(item({ ...nc, pendenciaStatus: 'fechada' }))).toBe('resolvido');
    expect(situacaoItem(item(nc))).toBe('a_avaliar');
  });
  it('pendência reaberta no Check list volta a tirar ponto', () => {
    expect(situacaoItem(item({ id: 'a', reconfirmar: true, pendenciaStatus: 'aberta' }))).toBe(
      'nao_conforme',
    );
  });
  it('revisão fechada ignora o que aconteceu depois com a pendência', () => {
    const nc = item({ id: 'a', resultado: 'nao_conforme', pendenciaStatus: 'fechada' });
    const ok = item({ id: 'b', resultado: 'conforme', pendenciaStatus: 'aberta' });
    expect(situacaoItem(itemCongelado(nc))).toBe('nao_conforme');
    expect(situacaoItem(itemCongelado(ok))).toBe('conforme');
    expect(evolucaoNota([itemCongelado(nc)], [item({ id: 'a', resultado: 'conforme' })])).toBe(100);
  });
  it('formata a variação com sinal', () => {
    expect(formatarEvolucao(5.83)).toBe('+5,8%');
    expect(formatarEvolucao(-1)).toBe('−1,0%');
    expect(formatarEvolucao(0)).toBe('0,0%');
  });
  it('conforme', () => {
    expect(situacaoItem(item({ id: 'a', resultado: 'conforme' }))).toBe('conforme');
  });
});

describe('notaAvaliacao', () => {
  it('reproduz a avaliação da Contorno: 6 não conformes em 103 itens dão 94,17%', () => {
    const itens = Array.from({ length: 103 }, (_, i) =>
      i < 6
        ? item({ id: `${i}`, resultado: 'nao_conforme', pendenciaStatus: 'aberta' })
        : item({ id: `${i}`, resultado: 'conforme' }),
    );
    const n = notaAvaliacao(itens);
    expect(n.obtidos).toBe(970);
    expect(n.total).toBe(1030);
    expect(n.pct).toBeCloseTo(94.17, 2);
    expect(n.naoConformes).toBe(6);
  });
  it('começa em 0% e só soma o que foi aprovado', () => {
    expect(notaAvaliacao([item({ id: 'a' }), item({ id: 'b', reconfirmar: true })]).pct).toBe(0);
  });
  it('o que falta avaliar não soma, e resolvido conta como aprovado', () => {
    const n = notaAvaliacao([
      item({ id: 'a' }),
      item({ id: 'b', resultado: 'nao_conforme', pendenciaStatus: 'fechada' }),
    ]);
    expect(n.pct).toBe(50);
    expect(n.respondidos).toBe(1);
  });
  it('lista vazia não divide por zero', () => {
    expect(notaAvaliacao([]).pct).toBe(0);
  });
});

describe('apresentação', () => {
  it('formata no padrão brasileiro', () => {
    expect(formatarNota(94.1747)).toBe('94,2%');
  });
  it('nota ao resolver soma os pontos do item', () => {
    const n = notaAvaliacao([
      item({ id: 'a', resultado: 'nao_conforme', pendenciaStatus: 'aberta' }),
      item({ id: 'b', resultado: 'conforme' }),
    ]);
    expect(notaAoResolver(n, 10)).toBe(100);
  });
  it('nota oficial', () => {
    expect(pctOficial(970, 1030)).toBeCloseTo(94.17, 2);
    expect(pctOficial(0, 0)).toBe(0);
  });
});

describe('resumoSecoes', () => {
  it('agrupa por ambiente, em ordem, com status', () => {
    const r = resumoSecoes([
      item({ id: 'c', secaoOrdem: 2, secao: 'Cozinha' }),
      item({ id: 'b', ordem: 2, resultado: 'nao_conforme', pendenciaStatus: 'aberta' }),
      item({ id: 'a', ordem: 1, resultado: 'conforme' }),
    ]);
    expect(r.map((s) => s.nome)).toEqual(['Recepção', 'Cozinha']);
    expect(r[0]?.itens.map((i) => i.id)).toEqual(['a', 'b']);
    expect(r[0]?.status).toBe('Concluído · 1 não conforme');
    expect(r[0]?.pct).toBe(50);
    expect(r[1]?.status).toBe('Não iniciado');
    expect(r[1]?.pct).toBeNull();
  });
  it('mostra o andamento parcial', () => {
    const r = resumoSecoes([item({ id: 'a', resultado: 'conforme' }), item({ id: 'b', ordem: 2 })]);
    expect(r[0]?.status).toBe('1 de 2 itens');
  });
});

describe('tirandoPonto', () => {
  it('só os não conformes, das altas para as baixas', () => {
    const crit: Record<string, string> = { a: 'baixa', b: 'alta' };
    const lista = tirandoPonto(
      [
        item({ id: 'a', resultado: 'nao_conforme', pendenciaStatus: 'aberta' }),
        item({ id: 'b', resultado: 'nao_conforme', pendenciaStatus: 'aberta' }),
        item({ id: 'c', resultado: 'conforme' }),
      ],
      (i) => crit[i.id] ?? null,
    );
    expect(lista.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('revisões', () => {
  it('fecha só com tudo respondido', () => {
    expect(
      faltamParaFechar([
        item({ id: 'a', resultado: 'conforme' }),
        item({ id: 'b', reconfirmar: true }),
        item({ id: 'c' }),
      ]),
    ).toBe(2);
  });
  it('prévia separa o que muda do que é mantido', () => {
    expect(
      previaNovaRevisao([
        item({ id: 'a', resultado: 'nao_conforme', pendenciaStatus: 'fechada' }),
        item({ id: 'b', resultado: 'nao_conforme', pendenciaStatus: 'aberta' }),
        item({ id: 'c', resultado: 'conforme' }),
        item({ id: 'd', resultado: 'conforme', pendenciaStatus: 'fechada' }),
        item({ id: 'e' }),
      ]),
    ).toEqual({ aReconfirmar: 1, pendentes: 1, mantidos: 2, aAvaliar: 1 });
  });
  it('compara pelo item da lista', () => {
    const nc = { resultado: 'nao_conforme' as const, pendenciaStatus: 'aberta' };
    const ok = { resultado: 'conforme' as const };
    const c = compararRevisoes(
      [item({ id: 'a', ...nc }), item({ id: 'b', ...ok }), item({ id: 'c', ...nc })],
      [
        item({ id: 'a', ...ok }),
        item({ id: 'b', ...nc }),
        item({ id: 'c', ...nc }),
        item({ id: 'd', ...nc }),
      ],
    );
    expect(c.melhorou.map((i) => i.id)).toEqual(['a']);
    expect(c.piorou.map((i) => i.id)).toEqual(['b', 'd']);
    expect(c.continua.map((i) => i.id)).toEqual(['c']);
    expect(c.ganhoPontos).toBe(-10);
  });
});
