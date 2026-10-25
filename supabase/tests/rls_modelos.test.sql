-- Teste de política (pgTAP) dos modelos. Roda com: supabase test db
-- Só gestor escreve modelos; equipe lê (para escolher ao criar obra); não-membro não lê.

begin;
select plan(10);

select ok((select relrowsecurity from pg_class where oid = 'public.modelo'::regclass), 'RLS em modelo');
select ok((select relrowsecurity from pg_class where oid = 'public.modelo_fase'::regclass), 'RLS em modelo_fase');
select ok((select relrowsecurity from pg_class where oid = 'public.modelo_atividade'::regclass), 'RLS em modelo_atividade');
select ok((select relrowsecurity from pg_class where oid = 'public.modelo_dependencia'::regclass), 'RLS em modelo_dependencia');
select ok((select relrowsecurity from pg_class where oid = 'public.modelo_providencia'::regclass), 'RLS em modelo_providencia');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'gestor@m1.contro'),
  ('00000000-0000-0000-0000-0000000000a2', 'equipe@m1.contro'),
  ('00000000-0000-0000-0000-0000000000a3', 'avulso@m1.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000a1', 'Gestor M1', 'gestor'),
  ('00000000-0000-0000-0000-0000000000a2', 'Equipe M1', 'equipe');

set local role authenticated;

-- GESTOR cria um modelo
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$ insert into modelo (nome, subtitulo) values ('Modelo Teste', 'RLS') $$,
  'gestor insere modelo'
);

-- EQUIPE lê, mas não escreve
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select is(
  (select count(*)::int from modelo where nome = 'Modelo Teste'),
  1,
  'equipe enxerga o modelo criado (para escolher na obra)'
);
select throws_ok(
  $$ insert into modelo (nome) values ('Proibido') $$,
  '42501', null,
  'equipe NÃO insere modelo'
);
select throws_ok(
  $$ insert into modelo_fase (modelo_id, ordem, titulo)
     select id, 1, 'F' from modelo limit 1 $$,
  '42501', null,
  'equipe NÃO insere fase de modelo'
);

-- NÃO-MEMBRO não enxerga modelo
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select is(
  (select count(*)::int from modelo),
  0,
  'não-membro NÃO enxerga modelos'
);

select * from finish();
rollback;
