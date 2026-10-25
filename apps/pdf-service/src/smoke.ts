// Gera PDFs de exemplo para conferir o layout: `pnpm --filter @contro/pdf-service smoke`.
import { mkdir, writeFile } from 'node:fs/promises';
import type { BoletimDados, ObraAta } from '@contro/core';
import { ataHtml, boletimHtml } from './html';
import { renderPdf } from './pdf';

const boletim: BoletimDados = {
  obra: 'Contorno do Corpo · Betim',
  semanaFmt: 'seg 26/10 a sex 30/10',
  realPct: 0.466,
  previstoSextaPct: 0.525,
  ritmoTexto: 'Atrasada · 3 dias',
  atrasos: ['Contratação: Elétrica Silva', 'Alvenaria da recepção'],
  concluir: [{ dataFmt: 'qua 28/10', nome: 'Demolição' }],
  comecar: [{ dataFmt: 'qui 29/10', nome: 'Alvenaria', motivo: 'aguarda providências' }],
  quemFazOQue: [
    { pessoa: 'João', itens: [{ dataFmt: 'qui 29/10', texto: 'Contratar elétrica' }] },
    { pessoa: 'Maria', itens: [{ dataFmt: null, texto: 'Acompanhar demolição' }] },
  ],
};

const obrasAta: ObraAta[] = [
  {
    nome: 'Contorno do Corpo · Betim',
    indicador: '47% · Atrasada · 3 dias',
    atrasos: ['Alvenaria da recepção'],
    concluir: ['Demolição'],
    comecar: ['Alvenaria'],
    providenciar: ['Compra: Porcelanato (na obra qua 28/10)'],
    observacoes: 'Comprar o porcelanato na terça para não atrasar o piso.',
  },
];

async function main(): Promise<void> {
  await mkdir('out', { recursive: true });
  const b = await renderPdf(boletimHtml(boletim));
  await writeFile('out/boletim.pdf', b);
  const a = await renderPdf(ataHtml('segunda, 26/10/2026', obrasAta));
  await writeFile('out/ata.pdf', a);
  console.log(`OK · out/boletim.pdf (${b.length} bytes) · out/ata.pdf (${a.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
