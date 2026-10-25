-- M10 · Boletim automático — fatia 3: assinaturas de Web Push.
-- Um aparelho = uma linha (endpoint único). Cada um gerencia a própria assinatura.
-- O envio é feito pela Edge Function (service role), que lê daqui.
create table push_subscription (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  criado_em timestamptz not null default now(),
  -- Anti-SSRF: só https e hosts conhecidos de serviços de push (a Edge Function
  -- faz POST neste endpoint). Cobre Chrome/Edge, Firefox, Safari e Windows.
  constraint push_endpoint_valido check (
    endpoint ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)/'
  )
);
create index push_subscription_user_idx on push_subscription (user_id);

alter table push_subscription enable row level security;

create policy push_sub_sel on push_subscription for select to authenticated
  using (user_id = auth.uid());
create policy push_sub_ins on push_subscription for insert to authenticated
  with check (user_id = auth.uid());
create policy push_sub_upd on push_subscription for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy push_sub_del on push_subscription for delete to authenticated
  using (user_id = auth.uid());
