import { describe, it, expect } from 'vitest';
import { montarObraAta, type BoletimDados } from '@contro/core';
import { boletimHtml, ataHtml, type AtaDados } from './html';

const boletim: BoletimDados = {
  obra: 'Obra Betim',
  semanaFmt: 'seg 26/10 a sex 30/10',
  realPct: 0.466,
  previstoSextaPct: 0.525,
  ritmoTexto: 'Atrasada · 3 dias',
  ritmoAtrasado: true,
  atrasos: ['Contratação: Elétrica', 'Alvenaria'],
  concluir: [{ dataFmt: 'qua 28/10', nome: 'Demolição' }],
  comecar: [{ dataFmt: 'qui 29/10', nome: 'Alvenaria', motivo: 'aguarda providências' }],
  quemFazOQue: [{ pessoa: 'João', itens: [{ dataFmt: 'qui 29/10', texto: 'Contratar elétrica' }] }],
};

describe('boletimHtml', () => {
  const html = boletimHtml(boletim);
  it('é um documento HTML A4 com a marca CONTRO', () => {
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('size: A4');
    expect(html).toContain('CONTRO');
  });
  it('arredonda os indicadores como a UI (47% / 53%)', () => {
    expect(html).toContain('47%');
    expect(html).toContain('53%');
  });
  it('mostra atrasos e usa a cor de atraso quando o ritmo está atrasado', () => {
    expect(html).toContain('2 em atraso');
    expect(html).toContain('Contratação: Elétrica');
    expect(html).toContain('class="atraso"');
  });
  it('lista concluir/começar e o quem faz o quê', () => {
    expect(html).toContain('Concluir esta semana');
    expect(html).toContain('Demolição');
    expect(html).toContain('aguarda providências');
    expect(html).toContain('João');
  });
  it('o vermelho vem do ritmoAtrasado do core, não de heurística de texto', () => {
    // sem atrasos e ritmo NÃO atrasado: nenhuma classe de atraso no documento
    const ok = boletimHtml({
      ...boletim,
      atrasos: [],
      ritmoAtrasado: false,
      ritmoTexto: 'No ritmo',
    });
    expect(ok).not.toContain('class="atraso"');
    // ritmo atrasado: o span do ritmo ganha a classe de atraso
    const atrasado = boletimHtml({ ...boletim, atrasos: [], ritmoAtrasado: true });
    expect(atrasado).toContain('class="atraso"');
  });
  it('trata item do quem faz o quê sem data (dataFmt null)', () => {
    const h = boletimHtml({
      ...boletim,
      quemFazOQue: [{ pessoa: 'Ana', itens: [{ dataFmt: null, texto: 'Acompanhar' }] }],
    });
    expect(h).toContain('Ana');
    expect(h).toContain('Acompanhar');
  });
});

const obraAta = (observacoes = 'Comprar na terça.') =>
  montarObraAta({
    nome: 'Obra Betim',
    indicador: '47% · atrasada · 3 dias',
    atrasada: true,
    situacao: 'Fase 3',
    itens: [
      {
        id: 'a1',
        nome: 'Contrapiso',
        secao: 'passada_concluir',
        resposta: 'nao_terminou',
        avancoPct: 50,
      },
      { id: 'a2', nome: 'Piso', secao: 'passada_comecar', resposta: 'comecou' },
      { id: 'a3', nome: 'Hidráulica', secao: 'semana_concluir', resposta: 'segue' },
    ],
    acoes: [
      { vinculoId: 'a1', texto: 'Concluir contrapiso', pessoa: 'Marcos', prazoFmt: 'qua 04/11' },
    ],
    cobranca: [],
    observacoes,
  });
const ata = (p: Partial<AtaDados> = {}): AtaDados => ({
  dataFmt: 'segunda, 02/11/2026',
  horaFmt: '16h',
  obras: [obraAta()],
  pessoas: [
    { pessoa: 'Marcos', itens: [{ texto: 'qua 04/11 · Concluir contrapiso', atrasado: false }] },
  ],
  totais: ['1 aconteceu', '1 não aconteceu'],
  resumo: false,
  ...p,
});

describe('ataHtml', () => {
  const html = ataHtml(ata());
  it('tem a obra, os blocos, a ação e as observações', () => {
    expect(html).toContain('Obra Betim');
    expect(html).toContain('47% · atrasada · 3 dias');
    expect(html).toContain('1 · Planejado e aconteceu');
    expect(html).toContain('Contrapiso · está em 50%');
    expect(html).toContain('Concluir contrapiso — Marcos, até qua 04/11');
    expect(html).toContain('Terminar Hidráulica · segue o plano');
    expect(html).toContain('Comprar na terça.');
    expect(html).toContain('Quem faz o quê');
    expect(html).toContain('1 obra');
    expect(html).toContain('Ata da semana · 16h');
  });
  it('só a ata: retrato e sem tabela', () => {
    expect(html).toContain('size: A4;');
    expect(html).not.toContain('class="tabela"');
  });
  it('com resumo: paisagem, tabela antes e a ata na página seguinte', () => {
    const r = ataHtml(ata({ resumo: true }));
    expect(r).toContain('size: A4 landscape;');
    expect(r).toContain('class="tabela"');
    expect(r).toContain('Semana passada · não cumprido → ação');
    expect(r.indexOf('class="tabela"')).toBeLessThan(r.indexOf('<h1>Ata da reunião</h1>'));
    expect(r).toContain('class="ata quebra"');
  });
  it('ata sem obras não quebra', () => {
    expect(ataHtml(ata({ obras: [], resumo: true }))).toContain('Sem obras nesta ata.');
  });
});

describe('escape de HTML', () => {
  it('escapa os caracteres perigosos (< > & aspas e apostrofo) no nome da obra', () => {
    const html = boletimHtml({ ...boletim, obra: `<script>a & b "c" 'd'</script>` });
    expect(html).not.toContain('<script>a');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
    expect(html).toContain('&#39;');
  });
  it('escapa injeção nas observações da ata (texto livre do usuário)', () => {
    const html = ataHtml(ata({ obras: [obraAta('</p><script>alert(1)</script>')], resumo: true }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
