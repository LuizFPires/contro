import { test, expect } from '@playwright/test';
import { login } from './util';
import { GESTOR } from './global-setup';

test('login do gestor leva à tela Minhas obras', async ({ page }) => {
  await login(page);
  await expect(page.getByText('Minhas obras')).toBeVisible();
});

test('credencial errada não entra', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail').fill(GESTOR.email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  // segue na tela de login (botão Entrar ainda visível, sem "Minhas obras")
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByText('Minhas obras')).toHaveCount(0);
});
