import { describe, it, expect } from 'vitest';
import type { BoletimDados, ObraAta } from '@contro/core';
import { boletimHtml, ataHtml } from './html';

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

describe('ataHtml', () => {
  const obras: ObraAta[] = [
    {
      nome: 'Obra Betim',
      indicador: '47% · Atrasada · 3 dias',
      atrasos: ['Alvenaria'],
      concluir: ['Demolição'],
      comecar: [],
      providenciar: ['Compra: Porcelanato'],
      observacoes: 'Comprar na terça.',
    },
  ];
  const html = ataHtml('segunda, 26/10/2026', obras);
  it('tem a obra, o indicador e as observações', () => {
    expect(html).toContain('Obra Betim');
    expect(html).toContain('47% · Atrasada · 3 dias');
    expect(html).toContain('Comprar na terça.');
    expect(html).toContain('1 obra');
  });
  it('ata sem obras não quebra', () => {
    expect(ataHtml('segunda, 26/10/2026', [])).toContain('Sem obras nesta ata.');
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
    const html = ataHtml('seg 26/10', [
      {
        nome: 'Obra X',
        indicador: '10%',
        atrasos: [],
        concluir: [],
        comecar: [],
        providenciar: [],
        observacoes: '</p><script>alert(1)</script>',
      },
    ]);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
