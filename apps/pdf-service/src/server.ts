import express from 'express';
import type { BoletimDados, ObraAta } from '@contro/core';
import { ataHtml, boletimHtml } from './html';
import { renderPdf } from './pdf';

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Boletim semanal de uma obra → PDF. Corpo: BoletimDados (do @contro/core).
app.post('/boletim', async (req, res) => {
  try {
    const pdf = await renderPdf(boletimHtml(req.body as BoletimDados));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="boletim.pdf"');
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ erro: String(e) });
  }
});

// Ata da reunião → PDF. Corpo: { dataFmt: string, obras: ObraAta[] }.
app.post('/ata', async (req, res) => {
  try {
    const { dataFmt, obras } = req.body as { dataFmt: string; obras: ObraAta[] };
    const pdf = await renderPdf(ataHtml(dataFmt, obras ?? []));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="ata.pdf"');
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ erro: String(e) });
  }
});

const port = Number(process.env.PORT ?? 4300);
app.listen(port, () => {
  console.log(`pdf-service ouvindo em http://localhost:${port}`);
});
