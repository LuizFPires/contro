import { test, expect, type Page } from '@playwright/test';
import { login } from './util';

// Lê quantas ops (não rejeitadas) estão na fila offline (Dexie `contro.outbox`).
function outboxCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((res) => {
        const req = indexedDB.open('contro');
        req.onsuccess = () => {
          try {
            const all = req.result.transaction('outbox').objectStore('outbox').getAll();
            all.onsuccess = () =>
              res(
                (all.result as { status: string }[]).filter((o) => o.status !== 'rejeitada').length,
              );
            all.onerror = () => res(-1);
          } catch {
            res(-1);
          }
        };
        req.onerror = () => res(-1);
      }),
  );
}

// Regra 9: a ação de campo é otimista, funciona offline E é de fato enfileirada
// (persistida), sincronizando sozinha quando o sinal volta.
test('providência offline: otimista, enfileira e sincroniza ao voltar (regra 9)', async ({
  page,
  context,
}) => {
  await login(page);

  const nome = `Obra Offline ${Date.now()}`;
  await page.getByRole('button', { name: 'Nova obra' }).click();
  await page.getByLabel('Nome da obra').fill(nome);
  await page.getByLabel('Modelo de obra').selectOption({ label: 'Modelo 1 · CDC completo' });
  await expect(page.getByText('Prévia')).toBeVisible();
  await page.getByRole('button', { name: 'Criar obra' }).click();
  await page.getByText(nome).click();

  await page.getByRole('button', { name: /^Providências/ }).click();
  const marcar = page.getByRole('button', { name: 'Marcar' });
  const antes = await marcar.count();
  expect(antes).toBeGreaterThan(0);

  // OFFLINE: toque instantâneo (otimista) + a op é realmente enfileirada.
  await context.setOffline(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await marcar.first().click();
  await expect(marcar).toHaveCount(antes - 1);
  await expect.poll(() => outboxCount(page)).toBeGreaterThan(0);

  // ONLINE: a fila drena sozinha (a op sai do outbox).
  await context.setOffline(false);
  await expect.poll(() => outboxCount(page), { timeout: 20_000 }).toBe(0);
});
