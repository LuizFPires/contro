-- Cadastro com aprovação (pgTAP). Roda com: supabase test db
-- Signup cria pessoa pendente; só gestor aprova.

begin;
select plan(7);

select ok(
  (select count(*) > 0 from pg_trigger where tgname = 'on_auth_user_created'),
  'trigger on_auth_user_created existe'
);

-- "Signup": inserir em auth.users dispara o trigger criando a pessoa pendente.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'novo@c.contro', '{"nome":"Novo Fulano"}');
select is(
  (select perfil::text from pessoa where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'equipe',
  'signup cria pessoa equipe'
);
select is(
  (select ativo from pessoa where user_id = '00000000-0000-0000-0000-0000000000a1'),
  false,
  'pessoa nasce pendente (ativo=false)'
);
select is(
  (select nome from pessoa where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'Novo Fulano',
  'nome vem do metadata do signup'
);

-- gestor (a2) e equipe ativa (a3)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'g@c.contro'),
  ('00000000-0000-0000-0000-0000000000a3', 'e@c.contro');
update pessoa set perfil = 'gestor', ativo = true where user_id = '00000000-0000-0000-0000-0000000000a2';
update pessoa set ativo = true where user_id = '00000000-0000-0000-0000-0000000000a3';

set local role authenticated;

-- GESTOR aprova o pendente a1
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$ select aprovar_pessoa((select id from pessoa where user_id = '00000000-0000-0000-0000-0000000000a1')) $$,
  'gestor aprova o cadastro'
);
select is(
  (select ativo from pessoa where user_id = '00000000-0000-0000-0000-0000000000a1'),
  true,
  'membro fica ativo após a aprovação'
);

-- EQUIPE não aprova
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$ select aprovar_pessoa((select id from pessoa where user_id = '00000000-0000-0000-0000-0000000000a3')) $$,
  '42501',
  null,
  'equipe NÃO aprova membros'
);

select * from finish();
rollback;
