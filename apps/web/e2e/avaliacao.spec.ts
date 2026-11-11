import { test, expect } from '@playwright/test';
import { login } from './util';

test('pré-avaliação: aba da obra, nota começa em zero e o Não grava na hora', async ({ page }) => {
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
  await expect(page.getByText('0,0%')).toBeVisible();

  await page.getByRole('button', { name: /Recepção/ }).click();
  await page.getByRole('button', { name: 'Catracas: conforme' }).click();
  await expect(page.getByText('1.1 · Conforme')).toBeVisible();

  // 10/11/2026: o Não grava na hora (tira ponto), mesmo sem a foto do antes.
  await page.getByRole('button', { name: 'Tomadas: não conforme' }).click();
  await expect(page.getByText('1.3 · Pendente no Check list · Média')).toBeVisible();
  await expect(page.getByText('Falta a foto do antes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Foto do antes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tomadas: não conforme' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
