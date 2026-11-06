-- Editar nome e cidade de obra geral: Gestor em qualquer uma, Coordenador nas dele.
begin;
select plan(9);

-- Elenco: A gestor (administrador), C coordenador de G1, D coordenador de G2,
-- M equipe de G1, K gestor só da Contorno.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000e0b01', 'a@edit.contro'),
  ('00000000-0000-0000-0000-0000000e0b02', 'c@edit.contro'),
  ('00000000-0000-0000-0000-0000000e0b03', 'd@edit.contro'),
  ('00000000-0000-0000-0000-0000000e0b04', 'm@edit.contro'),
  ('00000000-0000-0000-0000-0000000e0b05', 'k@edit.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000e0b01', 'Ed A', 'gestor'),
  ('00000000-0000-0000-0000-0000000e0b02', 'Ed C', 'equipe'),
  ('00000000-0000-0000-0000-0000000e0b03', 'Ed D', 'equipe'),
  ('00000000-0000-0000-0000-0000000e0b04', 'Ed M', 'equipe'),
  ('00000000-0000-0000-0000-0000000e0b05', 'Ed K', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000e0b01';
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where user_id in ('00000000-0000-0000-0000-0000000e0b02', '00000000-0000-0000-0000-0000000e0b03');
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id = '00000000-0000-0000-0000-0000000e0b04';

insert into obra (id, nome, cidade, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000e0b0001', 'Ed G1', 'Recife', '2031-01-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000e0b0002', 'Ed G2', null, '2031-01-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000e0b0003', 'Ed K', null, '2031-01-01', 'x', 'contorno');
insert into obra_participante (obra_id, pessoa_id)
  select o.id::uuid, p.id from pessoa p
  join (values
    ('00000000-0000-0000-0000-00000e0b0001', '00000000-0000-0000-0000-0000000e0b02'),
    ('00000000-0000-0000-0000-00000e0b0002', '00000000-0000-0000-0000-0000000e0b03'),
    ('00000000-0000-0000-0000-00000e0b0001', '00000000-0000-0000-0000-0000000e0b04')
  ) as o (id, uid) on p.user_id = o.uid::uuid;

set local role authenticated;

-- Gestor edita qualquer obra geral; nome é aparado e cidade vazia vira null.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e0b01","role":"authenticated"}';
select lives_ok($$ select editar_obra_geral('00000000-0000-0000-0000-00000e0b0002', '  Sede Nova ', '  ') $$,
  'Gestor edita obra geral');
select throws_ok($$ select editar_obra_geral('00000000-0000-0000-0000-00000e0b0002', '   ', 'X') $$,
  '22023', null, 'nome vazio → 22023');
select throws_ok($$ select editar_obra_geral('00000000-0000-0000-0000-00000e0b0003', 'Outra', null) $$,
  '23503', null, 'obra da Contorno não se edita por aqui');

-- Coordenador edita a obra dele, não a de outro.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e0b02","role":"authenticated"}';
select lives_ok($$ select editar_obra_geral('00000000-0000-0000-0000-00000e0b0001', 'Ed G1 Centro', 'Olinda') $$,
  'Coordenador edita a obra dele');
select throws_ok($$ select editar_obra_geral('00000000-0000-0000-0000-00000e0b0002', 'Invasão', null) $$,
  '23503', null, 'Coordenador não edita obra de que não participa');

-- Equipe e gestor só da Contorno não editam.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e0b04","role":"authenticated"}';
select throws_ok($$ select editar_obra_geral('00000000-0000-0000-0000-00000e0b0001', 'Equipe', null) $$,
  '42501', null, 'Equipe não edita');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e0b05","role":"authenticated"}';
select throws_ok($$ select editar_obra_geral('00000000-0000-0000-0000-00000e0b0001', 'Contorno', null) $$,
  '23503', null, 'gestor só da Contorno não vê obra geral');

reset role;
select is((select nome || '|' || coalesce(cidade, '-') from obra where id = '00000000-0000-0000-0000-00000e0b0002'),
  'Sede Nova|-', 'G2 gravada pelo Gestor');
select is((select nome || '|' || coalesce(cidade, '-') from obra where id = '00000000-0000-0000-0000-00000e0b0001'),
  'Ed G1 Centro|Olinda', 'G1 gravada pelo Coordenador');

select * from finish();
rollback;
