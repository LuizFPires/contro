import { test, expect } from '@playwright/test';
import { login } from './util';
import { GESTOR } from './global-setup';

test('login do gestor leva à tela inicial', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
});

test('credencial errada não entra', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail').fill(GESTOR.email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  // segue na tela de login (botão Entrar ainda visível, sem o menu inferior)
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toHaveCount(0);
});
