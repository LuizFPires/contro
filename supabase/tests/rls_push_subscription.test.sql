-- Política (pgTAP) das assinaturas de push. Roda com: supabase test db
-- Cada usuário só enxerga/gerencia a própria assinatura.

begin;
select plan(4);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_subscription'::regclass),
  'RLS em push_subscription'
);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'a@push.contro'),
  ('00000000-0000-0000-0000-0000000000d2', 'b@push.contro');
-- Assinatura do usuário A (inserida como owner, sem RLS).
insert into push_subscription (user_id, endpoint, p256dh, auth) values
  ('00000000-0000-0000-0000-0000000000d1', 'https://push/a', 'pa', 'aa');

set local role authenticated;

-- Usuário A vê a própria.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is((select count(*)::int from push_subscription), 1, 'A vê a própria assinatura');

-- Usuário B NÃO vê a de A.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select is((select count(*)::int from push_subscription), 0, 'B não vê a assinatura de A');

-- Usuário B NÃO insere assinatura em nome de A.
select throws_ok(
  $$ insert into push_subscription (user_id, endpoint, p256dh, auth)
     values ('00000000-0000-0000-0000-0000000000d1', 'https://push/x', 'p', 'a') $$,
  '42501',
  null,
  'B não insere assinatura para A'
);

select * from finish();
rollback;
