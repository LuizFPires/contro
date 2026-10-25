import { expect, type Page } from '@playwright/test';
import { GESTOR } from './global-setup';

/** Faz login como o gestor de E2E e espera a tela "Minhas obras". */
export async function login(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('E-mail').fill(GESTOR.email);
  await page.getByLabel('Senha').fill(GESTOR.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Minhas obras')).toBeVisible();
}
