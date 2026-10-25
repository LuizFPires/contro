import express, { type NextFunction, type Request, type Response } from 'express';
import type { BoletimDados, ObraAta } from '@contro/core';
import { ataHtml, boletimHtml } from './html';
import { fecharBrowser, renderPdf } from './pdf';

const app = express();

// CORS: o app (browser) chama o serviço de outra origem. Libera a origem
// configurada em PDF_CORS_ORIGIN (ex.: a do app) ou todas por padrão — serviço
// interno, sem credenciais e com corpo sem segredo. Responde o preflight.
const corsOrigin = process.env.PDF_CORS_ORIGIN ?? '*';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: '4mb' }));

function enviarPdf(res: Response, pdf: Buffer, nome: string): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nome}"`);
  res.send(pdf);
}

// Validações mínimas de forma: corpo inválido vira 400 (não 500).
function ehBoletim(b: unknown): b is BoletimDados {
  const d = b as Partial<BoletimDados> | null;
  return (
    !!d &&
    typeof d.obra === 'string' &&
    typeof d.realPct === 'number' &&
    typeof d.previstoSextaPct === 'number' &&
    typeof d.ritmoTexto === 'string' &&
    Array.isArray(d.atrasos) &&
    Array.isArray(d.concluir) &&
    Array.isArray(d.comecar) &&
    Array.isArray(d.quemFazOQue)
  );
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Boletim semanal de uma obra → PDF. Corpo: BoletimDados (do @contro/core).
app.post('/boletim', async (req, res) => {
  if (!ehBoletim(req.body)) {
    res.status(400).json({ erro: 'Corpo inválido para boletim' });
    return;
  }
  try {
    enviarPdf(res, await renderPdf(boletimHtml(req.body)), 'boletim.pdf');
  } catch (e) {
    console.error('Falha ao gerar o boletim:', e);
    res.status(500).json({ erro: 'Falha ao gerar o PDF' });
  }
});

// Ata da reunião → PDF. Corpo: { dataFmt: string, obras: ObraAta[] }.
app.post('/ata', async (req, res) => {
  const body = req.body as { dataFmt?: unknown; obras?: unknown };
  if (!body || typeof body.dataFmt !== 'string' || !Array.isArray(body.obras)) {
    res.status(400).json({ erro: 'Corpo inválido para ata' });
    return;
  }
  try {
    enviarPdf(res, await renderPdf(ataHtml(body.dataFmt, body.obras as ObraAta[])), 'ata.pdf');
  } catch (e) {
    console.error('Falha ao gerar a ata:', e);
    res.status(500).json({ erro: 'Falha ao gerar o PDF' });
  }
});

// Middleware de erro: JSON malformado (400) / corpo grande (413) sem vazar stack.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number; type?: string }).status ?? 500;
  console.error('Erro no pdf-service:', err);
  res.status(status === 413 ? 413 : status >= 400 && status < 500 ? 400 : 500).json({
    erro:
      status === 413 ? 'Corpo muito grande' : status < 500 ? 'Requisição inválida' : 'Erro interno',
  });
});

const port = Number(process.env.PORT ?? 4300);
const server = app.listen(port, () => {
  console.log(`pdf-service ouvindo em http://localhost:${port}`);
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    server.close(() => {
      void fecharBrowser().finally(() => process.exit(0));
    });
  });
}
