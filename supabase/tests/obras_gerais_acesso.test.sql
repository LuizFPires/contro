-- Obras gerais: acesso por ambiente e por obra.
begin;
select plan(33);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'm@geral.contro'),
  ('00000000-0000-0000-0000-0000000000c2', 'a@geral.contro'),
  ('00000000-0000-0000-0000-0000000000c3', 'c@geral.contro'),
  ('00000000-0000-0000-0000-0000000000c4', 'j@geral.contro'),
  ('00000000-0000-0000-0000-0000000000c5', 'x@geral.contro'),
  ('00000000-0000-0000-0000-0000000000c6', 'g@geral.contro'),
  ('00000000-0000-0000-0000-0000000000c7', 'h@geral.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000c1', 'Pessoa M', 'equipe'),
  ('00000000-0000-0000-0000-0000000000c2', 'Pessoa A', 'gestor'),
  ('00000000-0000-0000-0000-0000000000c3', 'Pessoa C', 'equipe'),
  ('00000000-0000-0000-0000-0000000000c4', 'Pessoa J', 'equipe'),
  ('00000000-0000-0000-0000-0000000000c6', 'Gestor Comum', 'gestor'),
  ('00000000-0000-0000-0000-0000000000c7', 'Gestor Geral', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000000c2';
update pessoa set acesso_contorno = false, papel_geral = 'coordenador' where user_id = '00000000-0000-0000-0000-0000000000c3';
update pessoa set acesso_contorno = false, papel_geral = 'membro' where user_id = '00000000-0000-0000-0000-0000000000c4';
update pessoa set acesso_contorno = false where user_id = '00000000-0000-0000-0000-0000000000c7';

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000000e001', 'Obra K', '2026-11-02', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000000e002', 'Obra G1', '2026-11-02', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000000e003', 'Obra G2', '2026-11-02', 'x', 'geral');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000000e002', id from pessoa where user_id = '00000000-0000-0000-0000-0000000000c3';
insert into convite_geral (email, nome, papel) values ('novo@x.com', 'Novo', 'membro');

set local role authenticated;

-- M (equipe Contorno)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select ok(contro_ve_obra('00000000-0000-0000-0000-00000000e001'), 'M ve K');
select ok(not contro_ve_obra('00000000-0000-0000-0000-00000000e002'), 'M nao ve G1');
select ok(contro_e_membro(), 'M e membro');
select ok(not contro_e_admin(), 'M nao e admin');

-- A (admin)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select ok(contro_ve_obra('00000000-0000-0000-0000-00000000e001'), 'A ve K');
select ok(contro_ve_obra('00000000-0000-0000-0000-00000000e002'), 'A ve G1');
select ok(contro_ve_obra('00000000-0000-0000-0000-00000000e003'), 'A ve G2');
select ok(contro_e_admin(), 'A e admin');
select is((select count(*)::int from convite_geral), 1, 'A ve convite_geral');
select throws_ok($$ insert into obra_participante (obra_id, pessoa_id) select '00000000-0000-0000-0000-00000000e003', id from pessoa limit 1 $$, '42501', null, 'A nao insere direto em obra_participante');
select throws_ok($$ insert into convite_geral (email, nome, papel) values ('y@x.com', 'Y', 'membro') $$, '42501', null, 'A nao insere direto em convite_geral');

-- C (coordenador de G1)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select ok(contro_ve_obra('00000000-0000-0000-0000-00000000e002'), 'C ve G1');
select ok(not contro_ve_obra('00000000-0000-0000-0000-00000000e003'), 'C nao ve G2');
select ok(not contro_ve_obra('00000000-0000-0000-0000-00000000e001'), 'C nao ve K');
select ok(not contro_e_membro(), 'C nao e membro');
select ok(not contro_e_admin(), 'C nao e admin');
select ok(contro_tem_acesso(), 'C tem acesso');
select ok(contro_coordena_obra('00000000-0000-0000-0000-00000000e002'), 'C coordena G1');
select ok(not contro_coordena_obra('00000000-0000-0000-0000-00000000e003'), 'C nao coordena G2');
select is((select count(*)::int from obra_participante), 1, 'C ve 1 participante');
select is((select count(*)::int from convite_geral), 0, 'C nao ve convite_geral');

-- J (membro sem obra)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c4","role":"authenticated"}';
select ok(contro_tem_acesso(), 'J tem acesso');
select ok(not contro_e_membro(), 'J nao e membro');
select ok(not contro_ve_obra('00000000-0000-0000-0000-00000000e002'), 'J nao ve G1');

-- Gestor comum (nao admin): nao escreve campos de papel/acesso
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c6","role":"authenticated"}';
select throws_ok($$ update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000000c6' $$, '42501', null, 'gestor nao se promove a administrador');
select throws_ok($$ update pessoa set papel_geral = 'coordenador' where user_id = '00000000-0000-0000-0000-0000000000c6' $$, '42501', null, 'gestor nao altera papel_geral');
select throws_ok($$ update pessoa set acesso_contorno = false where user_id = '00000000-0000-0000-0000-0000000000c6' $$, '42501', null, 'gestor nao altera acesso_contorno');
select lives_ok($$ update pessoa set nome = 'Gestor Renomeado' where user_id = '00000000-0000-0000-0000-0000000000c6' $$, 'gestor ainda edita nome');

-- Gestor sem acesso a Contorno: contro_perfil nulo
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated"}';
select is(contro_perfil()::text, null, 'gestor sem acesso_contorno tem contro_perfil nulo');

-- X (sem pessoa)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}';
select ok(not contro_ve_obra('00000000-0000-0000-0000-00000000e001'), 'X nao ve K');
select ok(not contro_ve_obra('00000000-0000-0000-0000-00000000e002'), 'X nao ve G1');
select ok(not (contro_e_membro() or contro_e_admin() or contro_tem_acesso()), 'X sem acesso');
select ok(not contro_coordena_obra('00000000-0000-0000-0000-00000000e002'), 'X nao coordena');

select * from finish();
rollback;
