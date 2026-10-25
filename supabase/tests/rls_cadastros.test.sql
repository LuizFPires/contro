-- Teste de política (pgTAP). Roda com: supabase test db
-- RLS dos cadastros: gestor escreve, equipe lê, não-membro é bloqueado.

begin;
select plan(9);

-- RLS habilitada nas três tabelas
select ok((select relrowsecurity from pg_class where oid = 'public.pessoa'::regclass), 'RLS ligada em pessoa');
select ok((select relrowsecurity from pg_class where oid = 'public.unidade'::regclass), 'RLS ligada em unidade');
select ok((select relrowsecurity from pg_class where oid = 'public.sugestao'::regclass), 'RLS ligada em sugestao');

-- Usuários de teste (gestor, equipe e um autenticado SEM pessoa)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'gestor@teste.contro'),
  ('00000000-0000-0000-0000-000000000002', 'equipe@teste.contro'),
  ('00000000-0000-0000-0000-000000000003', 'avulso@teste.contro');

insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-000000000001', 'Gestor Teste', 'gestor'),
  ('00000000-0000-0000-0000-000000000002', 'Equipe Teste', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;

-- GESTOR: insere unidade
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ insert into unidade (nome, cidade) values ('Unidade Y', 'Lagoa Santa') $$,
  'gestor insere unidade'
);

-- EQUIPE: lê a unidade criada, mas não escreve
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from unidade where nome = 'Unidade Y'),
  1,
  'equipe enxerga a unidade criada pelo gestor'
);
select throws_ok(
  $$ insert into unidade (nome) values ('Unidade X') $$,
  '42501', null,
  'equipe NÃO insere unidade (RLS)'
);
-- UPDATE sem policy de escrita: a RLS filtra a linha (0 afetadas, sem erro,
-- ao contrário do INSERT que viola o WITH CHECK e lança 42501).
update unidade set cidade = 'Outra' where nome = 'Unidade Y';
select is(
  (select cidade from unidade where nome = 'Unidade Y'),
  'Lagoa Santa',
  'equipe NÃO altera unidade (RLS filtra a linha)'
);
select lives_ok(
  $$ insert into sugestao (tipo, texto) values ('local', 'Coworking') $$,
  'equipe grava sugestão (cadastro pelo uso)'
);

-- NÃO-MEMBRO (autenticado sem pessoa): não enxerga nada
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(
  (select count(*)::int from unidade),
  0,
  'não-membro NÃO enxerga unidade (membro ativo exigido)'
);

select * from finish();
rollback;
