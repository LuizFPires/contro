import { test, expect } from '@playwright/test';
import { login } from './util';

// Regra 9: toda ação de campo é otimista e funciona offline — o toque dá
// feedback na hora, sem esperar o servidor. Aqui cortamos a rede e marcamos
// uma providência: ela sai da lista "a providenciar" imediatamente.
test('marcar providência é otimista e funciona offline (regra 9)', async ({ page, context }) => {
  await login(page);

  // Cria e abre uma obra do Modelo 1 (tem lembretes/providências).
  const nome = `Obra Offline ${Date.now()}`;
  await page.getByRole('button', { name: 'Nova obra' }).click();
  await page.getByLabel('Nome da obra').fill(nome);
  await page.getByLabel('Unidade').selectOption({ label: 'Contorno do Corpo · Betim' });
  await page.getByLabel('Modelo de obra').selectOption({ label: 'Modelo 1 · CDC completo' });
  await expect(page.getByText('Prévia')).toBeVisible();
  await page.getByRole('button', { name: 'Criar obra' }).click();
  await page.getByText(nome).click();

  await page.getByRole('tab', { name: /Providências/ }).click();
  const marcar = page.getByRole('button', { name: 'Marcar' });
  const antes = await marcar.count();
  expect(antes).toBeGreaterThan(0);

  // OFFLINE: o toque é instantâneo (otimista) — a providência deixa a lista.
  await context.setOffline(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await marcar.first().click();
  await expect(marcar).toHaveCount(antes - 1);

  await context.setOffline(false);
});
