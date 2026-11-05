-- Obras gerais: acesso por ambiente e por obra.
begin;
select plan(23);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'm@geral.contro'),
  ('00000000-0000-0000-0000-0000000000c2', 'a@geral.contro'),
  ('00000000-0000-0000-0000-0000000000c3', 'c@geral.contro'),
  ('00000000-0000-0000-0000-0000000000c4', 'j@geral.contro'),
  ('00000000-0000-0000-0000-0000000000c5', 'x@geral.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000c1', 'Pessoa M', 'equipe'),
  ('00000000-0000-0000-0000-0000000000c2', 'Pessoa A', 'gestor'),
  ('00000000-0000-0000-0000-0000000000c3', 'Pessoa C', 'equipe'),
  ('00000000-0000-0000-0000-0000000000c4', 'Pessoa J', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000000c2';
update pessoa set acesso_contorno = false, papel_geral = 'coordenador' where user_id = '00000000-0000-0000-0000-0000000000c3';
update pessoa set acesso_contorno = false, papel_geral = 'membro' where user_id = '00000000-0000-0000-0000-0000000000c4';

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

-- A (admin)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select ok(contro_ve_obra('00000000-0000-0000-0000-00000000e001'), 'A ve K');
select ok(contro_ve_obra('00000000-0000-0000-0000-00000000e002'), 'A ve G1');
select ok(contro_ve_obra('00000000-0000-0000-0000-00000000e003'), 'A ve G2');
select ok(contro_e_admin(), 'A e admin');
select is((select count(*)::int from convite_geral), 1, 'A ve convite_geral');

-- C (coordenador de G1)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select ok(contro_ve_obra('00000000-0000-0000-0000-00000000e002'), 'C ve G1');
select ok(not contro_ve_obra('00000000-0000-0000-0000-00000000e003'), 'C nao ve G2');
select ok(not contro_ve_obra('00000000-0000-0000-0000-00000000e001'), 'C nao ve K');
select ok(not contro_e_membro(), 'C nao e membro');
select ok(contro_tem_acesso(), 'C tem acesso');
select ok(contro_coordena_obra('00000000-0000-0000-0000-00000000e002'), 'C coordena G1');
select ok(not contro_coordena_obra('00000000-0000-0000-0000-00000000e003'), 'C nao coordena G2');
select is((select count(*)::int from obra_participante), 1, 'C ve 1 participante');
select is((select count(*)::int from convite_geral), 0, 'C nao ve convite_geral');

-- J (membro sem obra)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c4","role":"authenticated"}';
select ok(contro_tem_acesso(), 'J tem acesso');
select ok(not contro_ve_obra('00000000-0000-0000-0000-00000000e002'), 'J nao ve G1');

-- X (sem pessoa)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}';
select ok(not contro_ve_obra('00000000-0000-0000-0000-00000000e001'), 'X nao ve K');
select ok(not contro_ve_obra('00000000-0000-0000-0000-00000000e002'), 'X nao ve G1');
select ok(not (contro_e_membro() or contro_e_admin() or contro_tem_acesso()), 'X sem acesso');
select ok(not contro_coordena_obra('00000000-0000-0000-0000-00000000e002'), 'X nao coordena');

select * from finish();
rollback;
