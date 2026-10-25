import { chromium } from 'playwright';

/** Renderiza um HTML (A4) em PDF via Chromium headless (Playwright). */
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // networkidle espera a fonte do Google Fonts carregar (se houver rede).
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
