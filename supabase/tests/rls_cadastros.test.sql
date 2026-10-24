-- Teste de política (pgTAP). Roda com: supabase test db
-- Verifica que a RLS está ligada e que a equipe de obra não escreve cadastros.

begin;
select plan(7);

-- RLS habilitada nas três tabelas
select row_security_is_active('public', 'pessoa', 'RLS ligada em pessoa');
select row_security_is_active('public', 'unidade', 'RLS ligada em unidade');
select row_security_is_active('public', 'sugestao', 'RLS ligada em sugestao');

-- Usuários de teste
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'gestor@teste.obdc'),
  ('00000000-0000-0000-0000-000000000002', 'equipe@teste.obdc');

insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-000000000001', 'Gestor Teste', 'gestor'),
  ('00000000-0000-0000-0000-000000000002', 'Equipe Teste', 'equipe');

-- Como EQUIPE: pode ler unidade, não pode inserir
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ select * from unidade $$,
  'equipe lê unidade'
);
select throws_ok(
  $$ insert into unidade (nome) values ('Unidade X') $$,
  '42501',
  null,
  'equipe NÃO insere unidade (RLS)'
);

-- Como GESTOR: pode inserir unidade
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ insert into unidade (nome, cidade) values ('Unidade Y', 'Lagoa Santa') $$,
  'gestor insere unidade'
);

-- Qualquer autenticado escreve sugestão (cadastro pelo uso)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ insert into sugestao (tipo, texto) values ('local', 'Coworking') $$,
  'equipe grava sugestão'
);

select * from finish();
rollback;
