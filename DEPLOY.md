# DEPLOY · go-live do CONTRO

Guia para subir o CONTRO num ambiente real (homologação ou produção): banco no
**Supabase** e o PWA na **Vercel**. Siga na ordem.

> Projeto Supabase de referência: `contro` (ref `oaslrtizvfornxjuxpgp`, região `sa-east-1`).

## 0. Pré-requisitos
- Node 22 e pnpm 11 (`corepack enable`).
- Conta Supabase (projeto criado) e Supabase CLI (`supabase`).
- Conta Vercel.
- Repositório `LuizFPires/contro` no GitHub.

## 1. Supabase — banco
1. **Linkar o projeto** (ref do painel › Project Settings › General):
   ```bash
   supabase link --project-ref <PROJECT_REF>
   ```
2. **Ligar a extensão pg_cron ANTES de aplicar as migrations.** Os blocos que agendam os
   jobs são guardados por `if exists (... pg_cron)` — se a extensão não existir no momento
   do `db push`, os jobs ficam **silenciosamente não agendados**. No SQL editor:
   ```sql
   create extension if not exists pg_cron;
   ```
3. **Aplicar as migrations** (`supabase/migrations/`, M0→M8 — 22 arquivos):
   ```bash
   supabase db push
   ```
   Isso cria: `pessoa/unidade/sugestao`, `modelo*`, `obra*`, `foto`, `obra_providencia`,
   `pendencia*`, `tarefa*`, `reuniao*`, todas as **RPCs**, a **RLS**, os **triggers** e
   agenda os crons. O **bucket privado `fotos`** é criado pela migration
   `..._fotos_bucket.sql` (não precisa criar na mão).

   Crons agendados (confirme em `cron.job`): `reuniao-abrir-pauta` — segunda 15:30
   (`abrir_reuniao(current_date)`); `pendencia-devolver-adiadas` — diário 00:10
   (`pendencia_devolver_adiadas()`). Se você já tinha feito o `db push` **antes** de ligar
   o pg_cron, rode os dois `cron.schedule` à mão (o `db push` não re-executa migrations já
   aplicadas).
4. **Auth**: Authentication › Providers › **Email** ligado (e-mail + senha). Desligue
   "Confirm email" em homologação se quiser login imediato.
5. **Seed de homologação** (nunca em produção): modelos 1/2/3 e dados fictícios.
   ```bash
   pnpm db:reset   # supabase db reset: recria o schema + roda os seeds do config.toml
   ```
   (`supabase/seed.sql` + `supabase/seeds/modelos.sql` — os modelos 1/2/3 vêm do segundo.)
   Em produção, **não** rode o seed; crie os dados reais pelo app.
6. **Promover o primeiro gestor** (depois que a pessoa se cadastrar pelo app). No SQL
   editor, com service role:
   ```sql
   update pessoa set perfil = 'gestor', ativo = true where user_id = '<AUTH_USER_ID>';
   ```

## 2. Variáveis de ambiente
Do painel Supabase › Project Settings › **API**:
- `VITE_SUPABASE_URL` = Project URL (`https://<ref>.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` = chave **anon/publishable** (pode ir ao front; nunca a `service_role`)
- `VITE_SENTRY_DSN` = opcional (monitoramento)

Local: copie `apps/web/.env.example` para `apps/web/.env` e preencha.

## 3. Vercel — PWA
1. **Import** do repositório `LuizFPires/contro`. O `vercel.json` na raiz já define:
   - Install: `pnpm install --frozen-lockfile`
   - Build: `pnpm build` (filtra `@contro/web`)
   - Output: `apps/web/dist`
2. **Environment Variables**: adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   (e `VITE_SENTRY_DSN` se usar) em Production e Preview.
3. **Deploy**. A Vercel serve por HTTPS, então o **PWA é instalável** (manifest + service
   worker gerados pelo `vite-plugin-pwa`). Preview por PR já vem ligado.

## 4. Verificação pós-deploy
- Abrir a URL da Vercel → tela de login.
- Cadastrar/entrar; promover a gestor (passo 1.6); criar uma obra a partir de um modelo.
- Concluir uma atividade **com foto** (confirma Storage + URL assinada).
- Abrir Reunião (aba "Mais") e Boletim (ícone no cabeçalho da obra).

## 5. Limitações conhecidas (ver PILOTO.md)
- **PDF**: ata e boletim são **HTML imprimíveis** (WhatsApp + "imprimir como PDF" do
  navegador). O `pdf-service` (Playwright) ainda não existe.
- **Push e crons de boletim** (seg 06:30 / sex 17:00): não implementados — o boletim abre
  sob demanda.
- **Offline**: as ações de campo ainda **esperam o servidor** (sem fila Dexie). Em campo
  sem sinal, a ação falha com aviso; a fila offline é um milestone dedicado (M9-offline).
