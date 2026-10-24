# supabase · obdc

Migrations, RLS, seed e testes de política do obdc.

## Estrutura
- `migrations/` — schema versionado (aplicado em ordem).
- `seed.sql` — dados de **homologação** (nunca produção).
- `tests/` — testes de política (pgTAP), rodados com `supabase test db`.
- `config.toml` — config local mínima.

## Primeiros passos (precisa da conta Supabase)
1. Crie dois projetos no Supabase: **dev** e **homologação**.
2. `supabase link --project-ref <ref-do-projeto>`
3. `supabase db push` para aplicar as migrations.
4. Em homologação, `pnpm db:reset` aplica schema + seed.
5. Preencha `apps/web/.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
6. Promova o primeiro **gestor** (a RLS exige um gestor para criar cadastros):
   ```sql
   update pessoa set perfil = 'gestor' where user_id = '<uuid-do-auth>';
   ```

## Testes de RLS
```
supabase start
supabase test db
```
