-- Cadastro escolhe o ambiente (10/11/2026): quem escolhe Obras gerais não cai na
-- fila da Contorno; só o Administrador o vê e dá acesso ou manda para a Contorno.
begin;
select plan(18);

-- Gestor da Contorno (d1), Administrador (d2), Equipe (d3).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'gestor@amb.contro'),
  ('00000000-0000-0000-0000-0000000000d2', 'admin@amb.contro'),
  ('00000000-0000-0000-0000-0000000000d3', 'equipe@amb.contro');
update pessoa set perfil = 'gestor', ativo = true where user_id = '00000000-0000-0000-0000-0000000000d1';
update pessoa set perfil = 'gestor', ativo = true, administrador = true
  where user_id = '00000000-0000-0000-0000-0000000000d2';
update pessoa set ativo = true where user_id = '00000000-0000-0000-0000-0000000000d3';

-- Cadastros: Obras gerais (g1, g2), Contorno (k1) e app antigo sem ambiente (v1).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'ana@amb.contro', '{"nome":"Ana Geral","ambiente":"geral"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'bia@amb.contro', '{"nome":"Bia Geral","ambiente":"geral"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'kai@amb.contro', '{"nome":"Kai Contorno","ambiente":"contorno"}'),
  ('00000000-0000-0000-0000-0000000000f4', 'vel@amb.contro', '{"nome":"Vel Antigo"}');

select is(
  (select acesso_contorno from pessoa where user_id = '00000000-0000-0000-0000-0000000000f1'),
  false, 'cadastro de Obras gerais nasce fora da Contorno'
);
select is(
  (select ativo from pessoa where user_id = '00000000-0000-0000-0000-0000000000f1'),
  false, 'cadastro de Obras gerais nasce pendente'
);
select is(
  (select acesso_contorno from pessoa where user_id = '00000000-0000-0000-0000-0000000000f3'),
  true, 'cadastro da Contorno segue na fila da Contorno'
);
select is(
  (select acesso_contorno from pessoa where user_id = '00000000-0000-0000-0000-0000000000f4'),
  true, 'cadastro sem ambiente (app antigo) segue na fila da Contorno'
);

set local role authenticated;

-- Gestor da Contorno: não vê nem aprova cadastro de Obras gerais.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is(
  (select count(*)::int from pessoa where not ativo and nome in ('Ana Geral', 'Bia Geral')),
  0, 'gestor da Contorno não vê cadastro de Obras gerais'
);
select is(
  (select count(*)::int from pessoa where not ativo and nome = 'Kai Contorno'),
  1, 'gestor da Contorno vê o cadastro da Contorno'
);
reset role;
select set_config('test.ana', (select id::text from pessoa where user_id = '00000000-0000-0000-0000-0000000000f1'), true);
select set_config('test.bia', (select id::text from pessoa where user_id = '00000000-0000-0000-0000-0000000000f2'), true);
set local role authenticated;
select throws_ok(
  $$ select aprovar_pessoa(current_setting('test.ana')::uuid) $$,
  '22023', null, 'gestor da Contorno não aprova cadastro de Obras gerais'
);
select lives_ok(
  $$ select recusar_pessoa(current_setting('test.ana')::uuid) $$,
  'recusar cadastro de Obras gerais pela Contorno não faz nada'
);
select throws_ok(
  $$ select * from listar_cadastros_gerais_pendentes() $$,
  '42501', null, 'gestor da Contorno não lista a fila de Obras gerais'
);
select throws_ok(
  $$ select definir_fila_cadastro(current_setting('test.ana')::uuid, true) $$,
  '42501', null, 'gestor da Contorno não move cadastro de Obras gerais'
);

-- Equipe: não lista.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}';
select throws_ok(
  $$ select * from listar_cadastros_gerais_pendentes() $$,
  '42501', null, 'equipe não lista a fila de Obras gerais'
);

-- Administrador: lista os dois (Ana não foi recusada), com e-mail.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select results_eq(
  $$ select nome, email from listar_cadastros_gerais_pendentes()
     where email like '%@amb.contro' order by nome $$,
  $$ values ('Ana Geral'::text, 'ana@amb.contro'::text), ('Bia Geral', 'bia@amb.contro') $$,
  'administrador vê a fila de Obras gerais com o e-mail'
);

-- Dar acesso pelo e-mail: Ana fica ativa, só nas Obras gerais, e sai da fila.
select lives_ok(
  $$ select salvar_acesso_geral('ana@amb.contro', 'Ana Geral', 'membro', '{}'::uuid[]) $$,
  'administrador dá acesso ao cadastro pelo e-mail'
);
select is(
  (select count(*)::int from listar_cadastros_gerais_pendentes() where email = 'ana@amb.contro'),
  0, 'com acesso, sai da fila de Obras gerais'
);

-- Bia escolheu errado: vai para a fila da Contorno.
select lives_ok(
  $$ select definir_fila_cadastro(current_setting('test.bia')::uuid, true) $$,
  'administrador manda o cadastro para a Contorno'
);
select throws_ok(
  $$ select definir_fila_cadastro(current_setting('test.ana')::uuid, true) $$,
  '22023', null, 'cadastro já com acesso não troca de fila'
);
reset role;
select is(
  (select acesso_contorno from pessoa where user_id = '00000000-0000-0000-0000-0000000000f2'),
  true, 'cadastro movido entra na fila da Contorno'
);
select is(
  (select (ativo, acesso_contorno, papel_geral) from pessoa where user_id = '00000000-0000-0000-0000-0000000000f1')::text,
  '(t,f,membro)', 'Ana ficou ativa só nas Obras gerais'
);

select * from finish();
rollback;
