import { test, expect } from '@playwright/test';
import { login } from './util';

// A folha aberta trava o fundo com `position: fixed` no body. Se a impressão
// herdar essa trava, o PDF sai só com a primeira página, cortada.
test('o PDF de preparar a reunião sai com todas as páginas', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __impressoes: number };
    w.__impressoes = 0;
    window.print = () => {
      w.__impressoes += 1;
    };
  });
  await login(page);

  await page.getByRole('button', { name: 'Obras', exact: true }).click();
  await page.getByRole('button', { name: 'Nova obra' }).click();
  await page.getByLabel('Unidade').fill(`Obra PDF ${Date.now()}`);
  await page.getByRole('radio', { name: /Modelo 1 · CDC completo/ }).click();
  await page.getByRole('button', { name: 'Gerar cronograma e abrir obra' }).click();
  await expect(page.getByText('Mobilização', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Voltar' }).first().click();
  await page.getByRole('button', { name: /^Reunião/ }).click();
  const preparar = page.getByRole('button', { name: 'Preparar · PDF' });
  await expect(preparar).toBeEnabled();
  await preparar.click();

  // Marca os formatos: a tabela (paisagem) e a folha (retrato) nunca cabem na mesma página.
  const formatos = page.getByRole('checkbox');
  for (let i = 0; i < (await formatos.count()); i += 1) {
    if ((await formatos.nth(i).getAttribute('aria-checked')) !== 'true') {
      await formatos.nth(i).click();
    }
  }
  await page.getByRole('button', { name: /Baixar PDF/ }).click();
  await page.waitForFunction(
    () => (window as unknown as { __impressoes: number }).__impressoes > 0,
  );

  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const paginas = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
  expect(paginas).toBeGreaterThan(1);
});
