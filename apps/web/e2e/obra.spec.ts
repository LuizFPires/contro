import { test, expect } from '@playwright/test';
import { login } from './util';

test('cria obra a partir do Modelo 1 e abre a trilha de fases', async ({ page }) => {
  await login(page);
  const nome = `Obra E2E ${Date.now()}`;

  await page.getByRole('button', { name: 'Nova obra' }).click();
  await page.getByLabel('Nome da obra').fill(nome);
  await page.getByLabel('Unidade').selectOption({ label: 'Contorno do Corpo · Betim' });
  await page.getByLabel('Modelo de obra').selectOption({ label: 'Modelo 1 · CDC completo' });

  // A prévia é calculada pelo core (ex.: 28 atividades).
  await expect(page.getByText('Prévia')).toBeVisible();

  await page.getByRole('button', { name: 'Criar obra' }).click();

  // Volta para a lista com a obra criada; abre e vê a trilha de fases.
  const card = page.getByText(nome);
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByText('Mobilização')).toBeVisible();
});
