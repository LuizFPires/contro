# Push do boletim — runbook de deploy

Fatia 3b do boletim automático. O código já está pronto; faltam estes passos
(precisam de acesso ao Supabase/Vercel) para o push funcionar de verdade.

A lista "prontos para enviar" no Início **já funciona sem isto** — o push é um
reforço por cima dela.

## 1. Gerar as chaves VAPID

```bash
npx web-push generate-vapid-keys
```

Guarde a **Public Key** e a **Private Key**.

## 2. Frontend (Vercel) — chave pública

Defina a env no projeto `contro` (produção e preview) e refaça o deploy:

```bash
vercel env add VITE_VAPID_PUBLIC_KEY production --type config --value "<PUBLIC_KEY>" --yes
vercel env add VITE_VAPID_PUBLIC_KEY preview    --type config --value "<PUBLIC_KEY>" --yes
```

Sem ela, a opção "Receber aviso por push" nem aparece na tela do gestor.

## 3. Migrations

Aplique no Supabase remoto (SQL Editor ou `supabase db push`) as migrations do
boletim automático, incluindo `20261025020000_push_subscription.sql`.

## 4. Edge Function — segredos e deploy

Gere um segredo para autenticar o cron (ex.: `openssl rand -hex 32`) e defina os segredos:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="<PUBLIC_KEY>" \
  VAPID_PRIVATE_KEY="<PRIVATE_KEY>" \
  VAPID_SUBJECT="mailto:voce@contorno.app" \
  CRON_SECRET="<SEGREDO_ALEATORIO>"
supabase functions deploy enviar-push-boletim --no-verify-jwt
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente.
A função exige `Authorization: Bearer <CRON_SECRET>` (compara em tempo constante);
sem isso responde 401. É isso que protege o endpoint mesmo com `--no-verify-jwt`.

## 5. Agendar o envio (pg_cron + pg_net)

No SQL Editor, habilite as extensões e agende a chamada da função a cada 15 min.
Troque `<REF>` pelo ref do projeto e `<SERVICE_ROLE_KEY>` pela chave de serviço:

```sql
create extension if not exists pg_net;

select cron.schedule(
  'boletim-enviar-push',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/enviar-push-boletim',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

> Dica de segurança: em vez de embutir a chave no job, guarde-a no **Vault**
> (`vault.create_secret`) e leia com `vault.decrypted_secrets` dentro do job.

## 6. Testar

1. No app (gestor), abra **Mais → Boletim automático** e ative
   "Receber aviso por push neste aparelho" (conceda a permissão).
   - **iPhone:** só funciona com o app instalado na tela inicial (iOS 16.4+).
2. Force um disparo para testar sem esperar o horário:
   ```sql
   insert into boletim_disparo (obra_id, semana_inicio, edicao)
   select id, date_trunc('week', now())::date, 'principal'
   from obra where status = 'ativa' and deleted_at is null limit 1;
   ```
3. Chame a função uma vez (ou espere o cron) e confira a notificação:
   ```bash
   curl -X POST 'https://<REF>.supabase.co/functions/v1/enviar-push-boletim' \
     -H 'Authorization: Bearer <CRON_SECRET>'
   ```

## Como funciona

`gerar_disparos_boletim` (pg_cron, fatia 2) cria os `boletim_disparo` no horário.
Esta função lê os que ainda não têm `notificado_em`, manda o push aos gestores
inscritos, remove assinaturas inválidas (404/410) e marca `notificado_em`.
