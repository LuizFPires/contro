import { test, expect } from '@playwright/test';
import { login } from './util';

test('pré-avaliação: aba da obra, nota começa em zero e Não exige foto', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Obras', exact: true }).click();
  await page.getByRole('button', { name: 'Nova obra' }).click();
  await page.getByLabel('Unidade').fill(`Obra Aval ${Date.now()}`);
  await page.getByRole('radio', { name: /Modelo 1 · CDC completo/ }).click();
  await page.getByRole('button', { name: 'Gerar cronograma e abrir obra' }).click();
  await expect(page.getByText('Mobilização', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Avaliação', exact: true }).click();
  await page.getByRole('button', { name: 'Começar a 1ª revisão' }).click();
  await expect(page.getByText('0 de 103 itens')).toBeVisible();
  await expect(page.getByText('0 de 1.030 pts')).toBeVisible();
  await expect(page.getByText('0,0%')).toBeVisible();

  await page.getByRole('button', { name: /Recepção/ }).click();
  await page.getByRole('button', { name: 'Catracas: conforme' }).click();
  await expect(page.getByText('1.1 · Conforme')).toBeVisible();

  await page.getByRole('button', { name: 'Tomadas: não conforme' }).click();
  await expect(
    page.getByRole('button', { name: 'Tire a foto do antes para criar a pendência' }),
  ).toBeDisabled();
});
