// Gera PDFs de exemplo para conferir o layout: `pnpm --filter @contro/pdf-service smoke`.
import { mkdir, writeFile } from 'node:fs/promises';
import { montarObraAta, type BoletimDados, type ObraAta } from '@contro/core';
import { ataHtml, boletimHtml } from './html';
import { fecharBrowser, renderPdf } from './pdf';

const boletim: BoletimDados = {
  obra: 'Contorno do Corpo · Betim',
  semanaFmt: 'seg 26/10 a sex 30/10',
  realPct: 0.466,
  previstoSextaPct: 0.525,
  ritmoTexto: 'Atrasada · 3 dias',
  ritmoAtrasado: true,
  atrasos: ['Contratação: Elétrica Silva', 'Alvenaria da recepção'],
  concluir: [{ dataFmt: 'qua 28/10', nome: 'Demolição' }],
  comecar: [{ dataFmt: 'qui 29/10', nome: 'Alvenaria', motivo: 'aguarda providências' }],
  quemFazOQue: [
    { pessoa: 'João', itens: [{ dataFmt: 'qui 29/10', texto: 'Contratar elétrica' }] },
    { pessoa: 'Maria', itens: [{ dataFmt: null, texto: 'Acompanhar demolição' }] },
  ],
};

const obrasAta: ObraAta[] = [
  montarObraAta({
    nome: 'Contorno do Corpo · Betim',
    indicador: '47% · atrasada · 3 dias',
    atrasada: true,
    situacao: 'Fase 3 · previsto 52% · inauguração seg 21/12',
    itens: [
      {
        id: 'a1',
        nome: 'Contrapiso',
        secao: 'passada_concluir',
        resposta: 'nao_terminou',
        avancoPct: 50,
      },
      { id: 'a2', nome: 'Piso vinílico', secao: 'passada_comecar', resposta: 'comecou' },
      { id: 'a3', nome: 'Hidráulica', secao: 'semana_concluir', resposta: 'segue' },
      {
        id: 'p1',
        nome: 'Porcelanato',
        secao: 'semana_providencia',
        resposta: 'acao',
        tipoProvidencia: 'compra',
      },
    ],
    acoes: [
      { vinculoId: 'a1', texto: 'Concluir contrapiso', pessoa: 'Marcos', prazoFmt: 'qua 04/11' },
      { vinculoId: 'p1', texto: 'Comprar porcelanato', pessoa: 'Ana', prazoFmt: 'ter 03/11' },
    ],
    cobranca: [],
    observacoes: 'Comprar o porcelanato na terça para não atrasar o piso.',
  }),
];

async function main(): Promise<void> {
  await mkdir('out', { recursive: true });
  const b = await renderPdf(boletimHtml(boletim));
  await writeFile('out/boletim.pdf', b);
  const a = await renderPdf(
    ataHtml({
      dataFmt: 'segunda, 02/11/2026',
      horaFmt: '16h',
      obras: obrasAta,
      pessoas: [
        {
          pessoa: 'Marcos',
          itens: [{ texto: 'qua 04/11 · Concluir contrapiso (Betim)', atrasado: false }],
        },
      ],
      totais: ['1 aconteceu', '1 não aconteceu', '2 ações novas'],
      resumo: true,
    }),
  );
  await writeFile('out/ata.pdf', a);
  console.log(`OK · out/boletim.pdf (${b.length} bytes) · out/ata.pdf (${a.length} bytes)`);
  await fecharBrowser(); // fecha o Chromium para o processo encerrar
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
