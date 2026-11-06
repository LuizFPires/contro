begin;
select plan(9);

-- Elenco: G gestor, C coordenador da Contorno, C2 outro coordenador, E equipe,
-- GC coordenador só de Obras gerais.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000c0001', 'cc-gestor@contro.test'),
  ('00000000-0000-0000-0000-0000000c0002', 'cc-coord@contro.test'),
  ('00000000-0000-0000-0000-0000000c0003', 'cc-coord2@contro.test'),
  ('00000000-0000-0000-0000-0000000c0004', 'cc-equipe@contro.test'),
  ('00000000-0000-0000-0000-0000000c0005', 'cc-geral@contro.test');
insert into pessoa (id, user_id, nome, perfil, ativo) values
  ('00000000-0000-0000-0000-0000000cc001', '00000000-0000-0000-0000-0000000c0001', 'CC Gestor', 'gestor', true),
  ('00000000-0000-0000-0000-0000000cc002', '00000000-0000-0000-0000-0000000c0002', 'CC Coord', 'gestor', true),
  ('00000000-0000-0000-0000-0000000cc003', '00000000-0000-0000-0000-0000000c0003', 'CC Coord2', 'gestor', true),
  ('00000000-0000-0000-0000-0000000cc004', '00000000-0000-0000-0000-0000000c0004', 'CC Equipe', 'equipe', true),
  ('00000000-0000-0000-0000-0000000cc005', '00000000-0000-0000-0000-0000000c0005', 'CC Geral', 'equipe', true)
  on conflict (user_id) do update set perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set coordenador_contorno = true
  where id in ('00000000-0000-0000-0000-0000000cc002', '00000000-0000-0000-0000-0000000cc003');
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where id = '00000000-0000-0000-0000-0000000cc005';

set local role authenticated;

-- Coordenador da Contorno.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000c0002","role":"authenticated"}';
select lives_ok($$ select definir_membro_ativo('00000000-0000-0000-0000-0000000cc004', false) $$,
  'Coordenador desliga quem é da Equipe');
select lives_ok($$ select definir_membro_ativo('00000000-0000-0000-0000-0000000cc004', true) $$,
  'Coordenador religa quem é da Equipe');
select throws_ok($$ select definir_membro_ativo('00000000-0000-0000-0000-0000000cc001', false) $$,
  '42501', null, 'Coordenador não desliga Gestor');
select throws_ok($$ select definir_membro_ativo('00000000-0000-0000-0000-0000000cc003', false) $$,
  '42501', null, 'Coordenador não desliga outro Coordenador');
select throws_ok($$ select definir_membro_ativo('00000000-0000-0000-0000-0000000cc005', false) $$,
  '42501', null, 'Coordenador não desliga Coordenador de Obras gerais');
select throws_ok($$ update pessoa set coordenador_contorno = false where id = '00000000-0000-0000-0000-0000000cc002' $$,
  '42501', null, 'coordenador_contorno não se escreve direto');

-- Gestor desliga qualquer um.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000c0001","role":"authenticated"}';
select lives_ok($$ select definir_membro_ativo('00000000-0000-0000-0000-0000000cc002', false) $$,
  'Gestor desliga Coordenador');
select lives_ok($$ select definir_membro_ativo('00000000-0000-0000-0000-0000000cc005', false) $$,
  'Gestor desliga Coordenador de Obras gerais');

reset role;
select is((select count(*)::int from pessoa
  where id in ('00000000-0000-0000-0000-0000000cc002', '00000000-0000-0000-0000-0000000cc005') and not ativo),
  2, 'os dois ficaram desligados');

select * from finish();
rollback;
