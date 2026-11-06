-- Reordenar fases e atividades de obra geral: quem planeja; lista completa e sem repetição.
begin;
select plan(10);

-- Elenco: C coordenador de G1, M equipe de G1, D coordenador de outra obra.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000f0d01', 'c@ordem.contro'),
  ('00000000-0000-0000-0000-0000000f0d02', 'm@ordem.contro'),
  ('00000000-0000-0000-0000-0000000f0d03', 'd@ordem.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000f0d01', 'Ord C', 'equipe'),
  ('00000000-0000-0000-0000-0000000f0d02', 'Ord M', 'equipe'),
  ('00000000-0000-0000-0000-0000000f0d03', 'Ord D', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where user_id in ('00000000-0000-0000-0000-0000000f0d01', '00000000-0000-0000-0000-0000000f0d03');
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id = '00000000-0000-0000-0000-0000000f0d02';

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000f0d0001', 'Ord G1', '2031-01-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000f0d0002', 'Ord G2', '2031-01-01', 'x', 'geral');
insert into obra_participante (obra_id, pessoa_id)
  select o.id::uuid, p.id from pessoa p
  join (values
    ('00000000-0000-0000-0000-00000f0d0001', '00000000-0000-0000-0000-0000000f0d01'),
    ('00000000-0000-0000-0000-00000f0d0001', '00000000-0000-0000-0000-0000000f0d02'),
    ('00000000-0000-0000-0000-00000f0d0002', '00000000-0000-0000-0000-0000000f0d03')
  ) as o (id, uid) on p.user_id = o.uid::uuid;

-- Fases F1, F2, F3; na F1, atividades A1, A2 (A2 com subitem S) e A3 apagada.
insert into obra_fase (id, obra_id, ordem, titulo, preliminar) values
  ('00000000-0000-0000-0000-0000f0d0f001', '00000000-0000-0000-0000-00000f0d0001', 1, 'F1', false),
  ('00000000-0000-0000-0000-0000f0d0f002', '00000000-0000-0000-0000-00000f0d0001', 2, 'F2', false),
  ('00000000-0000-0000-0000-0000f0d0f003', '00000000-0000-0000-0000-00000f0d0001', 3, 'F3', false);
insert into obra_atividade (id, obra_id, fase_id, pai_id, ordem, nome, deleted_at) values
  ('00000000-0000-0000-0000-0000f0d0a001', '00000000-0000-0000-0000-00000f0d0001', '00000000-0000-0000-0000-0000f0d0f001', null, 1, 'A1', null),
  ('00000000-0000-0000-0000-0000f0d0a002', '00000000-0000-0000-0000-00000f0d0001', '00000000-0000-0000-0000-0000f0d0f001', null, 2, 'A2', null),
  ('00000000-0000-0000-0000-0000f0d0a003', '00000000-0000-0000-0000-00000f0d0001', '00000000-0000-0000-0000-0000f0d0f001', null, 3, 'A3', now()),
  ('00000000-0000-0000-0000-0000f0d0a004', '00000000-0000-0000-0000-00000f0d0001', '00000000-0000-0000-0000-0000f0d0f001', '00000000-0000-0000-0000-0000f0d0a002', 1, 'S', null);

set local role authenticated;

-- Coordenador da obra reordena.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000f0d01","role":"authenticated"}';
select lives_ok($$ select reordenar_fases_geral('00000000-0000-0000-0000-00000f0d0001', array[
  '00000000-0000-0000-0000-0000f0d0f003', '00000000-0000-0000-0000-0000f0d0f001', '00000000-0000-0000-0000-0000f0d0f002']::uuid[]) $$,
  'Coordenador reordena as fases');
select lives_ok($$ select reordenar_atividades_geral('00000000-0000-0000-0000-0000f0d0f001', array[
  '00000000-0000-0000-0000-0000f0d0a002', '00000000-0000-0000-0000-0000f0d0a001']::uuid[]) $$,
  'Coordenador reordena as atividades da fase (sem a apagada e sem subitem)');
select throws_ok($$ select reordenar_fases_geral('00000000-0000-0000-0000-00000f0d0001', array[
  '00000000-0000-0000-0000-0000f0d0f001', '00000000-0000-0000-0000-0000f0d0f002']::uuid[]) $$,
  '22023', null, 'lista incompleta → 22023');
select throws_ok($$ select reordenar_fases_geral('00000000-0000-0000-0000-00000f0d0001', array[
  '00000000-0000-0000-0000-0000f0d0f001', '00000000-0000-0000-0000-0000f0d0f001', '00000000-0000-0000-0000-0000f0d0f002']::uuid[]) $$,
  '22023', null, 'lista com repetição → 22023');
select throws_ok($$ select reordenar_atividades_geral('00000000-0000-0000-0000-0000f0d0f001', array[
  '00000000-0000-0000-0000-0000f0d0a002', '00000000-0000-0000-0000-0000f0d0a004']::uuid[]) $$,
  '22023', null, 'subitem no lugar de atividade → 22023');

-- Equipe e coordenador de outra obra não reordenam.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000f0d02","role":"authenticated"}';
select throws_ok($$ select reordenar_fases_geral('00000000-0000-0000-0000-00000f0d0001', array[
  '00000000-0000-0000-0000-0000f0d0f001', '00000000-0000-0000-0000-0000f0d0f002', '00000000-0000-0000-0000-0000f0d0f003']::uuid[]) $$,
  '42501', null, 'Equipe não reordena');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000f0d03","role":"authenticated"}';
select throws_ok($$ select reordenar_atividades_geral('00000000-0000-0000-0000-0000f0d0f001', array[
  '00000000-0000-0000-0000-0000f0d0a001', '00000000-0000-0000-0000-0000f0d0a002']::uuid[]) $$,
  '42501', null, 'Coordenador de outra obra não reordena');

reset role;
select is((select string_agg(titulo, ',' order by ordem) from obra_fase
  where obra_id = '00000000-0000-0000-0000-00000f0d0001'), 'F3,F1,F2', 'fases na ordem nova');
select is((select string_agg(nome, ',' order by ordem) from obra_atividade
  where fase_id = '00000000-0000-0000-0000-0000f0d0f001' and pai_id is null and deleted_at is null),
  'A2,A1', 'atividades na ordem nova');
select is((select ordem from obra_atividade where id = '00000000-0000-0000-0000-0000f0d0a004'), 1,
  'subitem não muda');

select * from finish();
rollback;
