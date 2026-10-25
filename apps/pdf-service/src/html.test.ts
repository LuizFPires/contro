import { describe, it, expect } from 'vitest';
import type { BoletimDados, ObraAta } from '@contro/core';
import { boletimHtml, ataHtml } from './html';

const boletim: BoletimDados = {
  obra: 'Obra Betim',
  semanaFmt: 'seg 26/10 a sex 30/10',
  realPct: 0.466,
  previstoSextaPct: 0.525,
  ritmoTexto: 'Atrasada · 3 dias',
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
  it('escapa caracteres perigosos no nome da obra', () => {
    const html = boletimHtml({ ...boletim, obra: '<script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
