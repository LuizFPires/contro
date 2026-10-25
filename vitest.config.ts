import { defineConfig, configDefaults } from 'vitest/config';

// Testes unitários (Vitest). As specs de E2E (Playwright) ficam em e2e/ e são
// rodadas pelo `pnpm test:e2e` — não devem ser coletadas aqui.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/e2e/**'],
  },
});
