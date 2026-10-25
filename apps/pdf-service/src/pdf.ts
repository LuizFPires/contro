import { chromium, type Browser } from 'playwright';

// Reaproveita UM Chromium entre requisições (lançar por request é caro e, sob
// carga, N browsers = risco de OOM). Cada render usa uma página nova.
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = chromium.launch();
  return browserPromise;
}

/** Renderiza um HTML (A4) em PDF via Chromium headless (Playwright). */
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // 'load' (não 'networkidle'): o template não depende de rede externa, então
    // não há o que esperar da rede; timeout curto evita render preso.
    await page.setContent(html, { waitUntil: 'load', timeout: 15_000 });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/** Fecha o Chromium compartilhado (shutdown gracioso). */
export async function fecharBrowser(): Promise<void> {
  if (!browserPromise) return;
  const b = await browserPromise;
  browserPromise = null;
  await b.close();
}
