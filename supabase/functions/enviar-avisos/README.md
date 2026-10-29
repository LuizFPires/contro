# Avisos por push (reunião, resumo, tarefas, providências) — como ligar

**Ligado em produção em 28/10/2026** (passos 1 a 5 feitos; teste recebido no
celular). Este roteiro fica para refazer em outro ambiente ou para trocar as
chaves. Os passos são feitos uma vez, por quem tem acesso ao Supabase e à
Vercel, e ligam também o push do boletim (`enviar-push-boletim`), que usa as
mesmas chaves.

Cuidados que apareceram ao ligar:
- No PowerShell, rode um `secrets set` por linha (colar o comando quebrado em
  várias linhas grava só a primeira chave) e use aspas retas `"`, não `”`.
- Na Vercel, `VITE_VAPID_PUBLIC_KEY` é do tipo **Config** (a chave pública vai
  no app); depois de criar, faça Redeploy.
- No teste do passo 5, filtre a pessoa pelo nome exato: `limit 1` com `ilike`
  pode pegar outra pessoa de nome parecido.

## 1. Gerar as chaves VAPID

```bash
npx web-push generate-vapid-keys
```

Guarde a **Public Key** e a **Private Key**.

## 2. Vercel — chave pública

No painel da Vercel, projeto `contro` → Settings → Environment Variables, crie
`VITE_VAPID_PUBLIC_KEY` com a **Public Key** (Production e Preview) e faça um
novo deploy. Sem ela, "Avisos neste celular" não aparece no app.

## 3. Supabase — segredos e as duas funções

Gere um segredo para o cron (ex.: `openssl rand -hex 32`) e rode na pasta do projeto:

```bash
npx supabase secrets set VAPID_PUBLIC_KEY="<PUBLIC_KEY>" VAPID_PRIVATE_KEY="<PRIVATE_KEY>" VAPID_SUBJECT="mailto:voce@contorno.app" CRON_SECRET="<SEGREDO>"
npx supabase functions deploy enviar-avisos --no-verify-jwt
npx supabase functions deploy enviar-push-boletim --no-verify-jwt
```

As funções exigem `Authorization: Bearer <CRON_SECRET>`; sem isso respondem 401.

## 4. Agendar o envio (SQL Editor do Supabase)

`gerar_avisos()` já roda sozinho a cada 5 min (migration). Falta o envio.
Troque `<REF>` pelo ref do projeto e `<SEGREDO>` pelo CRON_SECRET:

```sql
create extension if not exists pg_net;

select cron.schedule('avisos-enviar', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/enviar-avisos',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer <SEGREDO>'),
    body := '{}'::jsonb);
$$);

select cron.schedule('boletim-enviar-push', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/enviar-push-boletim',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer <SEGREDO>'),
    body := '{}'::jsonb);
$$);
```

## 5. Testar

1. No app: perfil → **Avisos neste celular** → Ativar (aceite a permissão).
   **iPhone:** só funciona com o CONTRO instalado na tela inicial (iOS 16.4+).
2. Force um aviso para você e chame a função:
   ```sql
   insert into aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
   select 'resumo', current_date, user_id, 'CONTRO · Teste', 'Push funcionando.', '/'
   from pessoa where nome = '<seu nome exato>';
   ```
   ```bash
   curl -X POST 'https://<REF>.supabase.co/functions/v1/enviar-avisos' -H 'Authorization: Bearer <SEGREDO>'
   ```

## Como funciona

`config_avisos` guarda o dia/horário da reunião e os avisos (o gestor edita em
**Reunião e avisos**). `gerar_avisos()` (pg_cron, a cada 5 min, fuso de São
Paulo) grava um `aviso_disparo` por pessoa, tipo e dia, dentro de 3 h depois do
horário. Esta função lê os que não foram enviados, manda o push aos aparelhos
de cada pessoa, remove assinaturas vencidas (404/410) e marca `notificado_em`.
