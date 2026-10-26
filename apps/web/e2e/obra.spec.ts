import { test, expect } from '@playwright/test';
import { login } from './util';

test('cria obra a partir do Modelo 1 e abre a trilha de fases', async ({ page }) => {
  await login(page);
  const nome = `Obra E2E ${Date.now()}`;

  // A tela inicial abre em "Hoje"; a nova obra fica na aba "Minhas obras".
  await page.getByRole('button', { name: 'Minhas obras' }).click();
  await page.getByRole('button', { name: 'Nova obra' }).click();
  await page.getByLabel('Unidade').fill(nome);
  await page.getByRole('radio', { name: /Modelo 1 · CDC completo/ }).click();

  // A prévia é calculada pelo core (ex.: 28 atividades).
  await expect(page.getByText('Como a obra vai nascer')).toBeVisible();

  await page.getByRole('button', { name: 'Gerar cronograma e abrir obra' }).click();

  // A obra criada abre direto (protótipo) e mostra a trilha de fases.
  await expect(page.getByRole('heading', { name: nome })).toBeVisible();
  await expect(page.getByText('Mobilização', { exact: true })).toBeVisible();
});
