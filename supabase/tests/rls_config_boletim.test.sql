-- Política (pgTAP) da config do boletim automático. Roda com: supabase test db
-- Só gestor edita o agendamento; equipe lê; não-membro não lê.

begin;
select plan(7);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.config_boletim'::regclass),
  'RLS em config_boletim'
);
select is(
  (select count(*)::int from config_boletim),
  1,
  'config_boletim nasce com a linha única (singleton)'
);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'gestor@cb.contro'),
  ('00000000-0000-0000-0000-0000000000b2', 'equipe@cb.contro'),
  ('00000000-0000-0000-0000-0000000000b3', 'avulso@cb.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000b1', 'Gestor CB', 'gestor'),
  ('00000000-0000-0000-0000-0000000000b2', 'Equipe CB', 'equipe');

set local role authenticated;

-- GESTOR edita o agendamento
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select lives_ok(
  $$ update config_boletim set dia_semana = 3, hora = '08:00' where id $$,
  'gestor edita o agendamento'
);
select is(
  (select dia_semana from config_boletim where id),
  3::smallint,
  'gestor gravou dia_semana = 3'
);

-- EQUIPE lê, mas não edita (RLS filtra as linhas: 0 afetadas, valor não muda)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select is(
  (select count(*)::int from config_boletim),
  1,
  'equipe lê o agendamento'
);
update config_boletim set dia_semana = 6 where id;
select is(
  (select dia_semana from config_boletim where id),
  3::smallint,
  'equipe NÃO altera o agendamento (RLS)'
);

-- NÃO-MEMBRO não lê
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}';
select is(
  (select count(*)::int from config_boletim),
  0,
  'não-membro NÃO lê o agendamento'
);

select * from finish();
rollback;
