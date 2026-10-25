import { chromium, type Browser } from 'playwright';

// Reaproveita UM Chromium entre requisições (lançar por request é caro e, sob
// carga, N browsers = risco de OOM). Cada render usa uma página nova.
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;
  const p = chromium
    .launch()
    .then((b) => {
      // Se o Chromium cair, limpa o cache para a próxima requisição relançar
      // (senão ficaríamos presos num browser morto — fail-closed/DoS).
      b.on('disconnected', () => {
        if (browserPromise === p) browserPromise = null;
      });
      return b;
    })
    .catch((e: unknown) => {
      // Falha no launch: limpa para tentar de novo na próxima, em vez de deixar
      // uma promise rejeitada em cache para sempre.
      if (browserPromise === p) browserPromise = null;
      throw e;
    });
  browserPromise = p;
  return p;
}

/** Renderiza um HTML (A4) em PDF via Chromium headless (Playwright). */
export async function renderPdf(html: string): Promise<Buffer> {
  let browser = await getBrowser();
  if (!browser.isConnected()) {
    browserPromise = null;
    browser = await getBrowser();
  }
  const page = await browser.newPage();
  try {
    // 'load' (não 'networkidle'): o template não depende de rede externa, então
    // não há o que esperar da rede; timeouts curtos evitam render preso.
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
  const p = browserPromise;
  browserPromise = null;
  await p.then((b) => b.close()).catch(() => {});
}
