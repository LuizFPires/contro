import { test, expect } from '@playwright/test';
import { login } from './util';

// Pedidos do João e do Matheus (28/11/2026): mudar o início da obra pelo "⋮" e
// concluir a obra, que sai de Minhas obras e fica em Obras concluídas (perfil).
test('muda o início, conclui e reabre a obra', async ({ page }) => {
  await login(page);
  const nome = `Obra Concluir ${Date.now()}`;

  await page.getByRole('button', { name: 'Obras', exact: true }).click();
  await page.getByRole('button', { name: 'Nova obra' }).click();
  await page.getByLabel('Unidade').fill(nome);
  await page.getByRole('radio', { name: /Modelo 1 · CDC completo/ }).click();
  await page.getByRole('button', { name: 'Gerar cronograma e abrir obra' }).click();
  await expect(page.getByRole('heading', { name: nome })).toBeVisible();

  // Mudar início: uma semana antes adianta a obra em 5 dias úteis.
  await page.getByRole('button', { name: 'Mais opções da obra' }).click();
  await page.getByRole('menuitem', { name: 'Mudar início da obra' }).click();
  await page.getByRole('button', { name: '1 semana antes' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Adianta a obra em 5 dias úteis' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mudar início', exact: true }).click();
  await expect(page.getByText(/Obra começa/)).toBeVisible();

  // Concluir: sem pendência, sai da lista.
  await page.getByRole('button', { name: 'Mais opções da obra' }).click();
  await page.getByRole('menuitem', { name: 'Concluir obra' }).click();
  await expect(page.getByText('Nenhuma pendência aberta no Check list.')).toBeVisible();
  await page.screenshot({ path: 'test-results/concluir-obra.png' });
  await page.getByRole('button', { name: 'Concluir obra', exact: true }).click();
  await expect(page.getByText('Obra concluída', { exact: true })).toBeVisible();
  await expect(page.getByText(nome)).toHaveCount(0);

  // Obras concluídas, pelo perfil: abre a obra e reabre.
  await page.getByRole('button', { name: /Perfil e ajustes/ }).click();
  await page.getByRole('button', { name: 'Obras concluídas' }).click();
  await expect(page.getByRole('heading', { name: 'Obras concluídas' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(nome) }).click();
  await expect(page.getByRole('heading', { name: nome })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Reabrir' })).toBeVisible();
  await page.screenshot({ path: 'test-results/obra-concluida.png' });
  await page.getByRole('button', { name: 'Reabrir', exact: true }).click();
  await expect(page.getByText(`Obra "${nome}" reaberta`)).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Reabrir' })).toHaveCount(0);
});
