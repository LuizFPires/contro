-- Obras gerais · Etapa 2: Pessoas da obra. O Coordenador adiciona, convida e
-- remove Membros da obra; quem sai da obra deixa as atividades abertas sem
-- responsável; quem tem papel em Obras gerais vê os Administradores.
begin;
select plan(60);

-- Elenco: K equipe só da Contorno (será convidado pelo e-mail), A administrador,
-- C coordenador de G1 e G3, C2 coordenador de G1, J membro de G1 e G2,
-- L membro de G2, T (Matheus) gestor da Contorno que não é administrador,
-- M equipe só da Contorno.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000004d1', 'k@pdo.contro'),
  ('00000000-0000-0000-0000-0000000004d2', 'a@pdo.contro'),
  ('00000000-0000-0000-0000-0000000004d3', 'c@pdo.contro'),
  ('00000000-0000-0000-0000-0000000004d4', 'c2@pdo.contro'),
  ('00000000-0000-0000-0000-0000000004d5', 'j@pdo.contro'),
  ('00000000-0000-0000-0000-0000000004d6', 'l@pdo.contro'),
  ('00000000-0000-0000-0000-0000000004d7', 't@pdo.contro'),
  ('00000000-0000-0000-0000-0000000004d9', 'm@pdo.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000004d1', 'Pdo K', 'equipe'),
  ('00000000-0000-0000-0000-0000000004d2', 'Pdo A', 'gestor'),
  ('00000000-0000-0000-0000-0000000004d3', 'Pdo C', 'equipe'),
  ('00000000-0000-0000-0000-0000000004d4', 'Pdo C2', 'equipe'),
  ('00000000-0000-0000-0000-0000000004d5', 'Pdo J', 'equipe'),
  ('00000000-0000-0000-0000-0000000004d6', 'Pdo L', 'equipe'),
  ('00000000-0000-0000-0000-0000000004d7', 'Pdo Matheus', 'gestor'),
  ('00000000-0000-0000-0000-0000000004d9', 'Pdo M', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000004d2';
-- P pendente na Contorno (nunca aprovado) e D desativado.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000004da', 'p@pdo.contro'),
  ('00000000-0000-0000-0000-0000000004db', 'd@pdo.contro');
update pessoa set nome = 'Pdo P', ativo = false where user_id = '00000000-0000-0000-0000-0000000004da';
update pessoa set nome = 'Pdo D', ativo = false, desativado_em = now() where user_id = '00000000-0000-0000-0000-0000000004db';
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where user_id in ('00000000-0000-0000-0000-0000000004d3', '00000000-0000-0000-0000-0000000004d4');
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id in ('00000000-0000-0000-0000-0000000004d5', '00000000-0000-0000-0000-0000000004d6');

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000004f001', 'Pdo G1', '2026-11-02', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000004f002', 'Pdo G2', '2026-11-02', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000004f003', 'Pdo K', '2026-11-02', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000004f004', 'Pdo G3', '2026-11-02', 'x', 'geral');

create temp table ids as
  select split_part(nome, ' ', 2) as quem, id from pessoa
  where user_id::text like '00000000-0000-0000-0000-0000000004d_';
grant select on ids to authenticated;

insert into obra_participante (obra_id, pessoa_id)
  select o.id::uuid, i.id from ids i
  join (values
    ('00000000-0000-0000-0000-00000004f001', 'C'), ('00000000-0000-0000-0000-00000004f004', 'C'),
    ('00000000-0000-0000-0000-00000004f001', 'C2'),
    ('00000000-0000-0000-0000-00000004f001', 'J'), ('00000000-0000-0000-0000-00000004f002', 'J'),
    ('00000000-0000-0000-0000-00000004f002', 'L')
  ) as o (id, quem) on o.quem = i.quem;

insert into obra_fase (id, obra_id, ordem, titulo) values
  ('00000000-0000-0000-0000-00000004f101', '00000000-0000-0000-0000-00000004f001', 1, 'Fase G1'),
  ('00000000-0000-0000-0000-00000004f102', '00000000-0000-0000-0000-00000004f002', 1, 'Fase G2');
-- 201 aberta de J em G1, 202 concluída de J em G1, 203 aberta de J em G2,
-- 204 aberta de L em G1 (depois que L entra), 205 aberta de L em G2.
insert into obra_atividade (id, obra_id, fase_id, ordem, nome, responsavel_id, concluida_em) values
  ('00000000-0000-0000-0000-00000004f201', '00000000-0000-0000-0000-00000004f001', '00000000-0000-0000-0000-00000004f101', 1, 'J aberta G1',
   (select id from ids where quem = 'J'), null),
  ('00000000-0000-0000-0000-00000004f202', '00000000-0000-0000-0000-00000004f001', '00000000-0000-0000-0000-00000004f101', 2, 'J concluída G1',
   (select id from ids where quem = 'J'), now()),
  ('00000000-0000-0000-0000-00000004f203', '00000000-0000-0000-0000-00000004f002', '00000000-0000-0000-0000-00000004f102', 1, 'J aberta G2',
   (select id from ids where quem = 'J'), null),
  ('00000000-0000-0000-0000-00000004f204', '00000000-0000-0000-0000-00000004f001', '00000000-0000-0000-0000-00000004f101', 3, 'L aberta G1',
   (select id from ids where quem = 'L'), null),
  ('00000000-0000-0000-0000-00000004f205', '00000000-0000-0000-0000-00000004f002', '00000000-0000-0000-0000-00000004f102', 2, 'L aberta G2',
   (select id from ids where quem = 'L'), null);

set local role authenticated;

-- C (coordenador de G1 e G3)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004d3","role":"authenticated"}';

-- adicionar_membro_obra
select lives_ok(
  $$ select adicionar_membro_obra('00000000-0000-0000-0000-00000004f001', (select id from ids where quem = 'L')) $$,
  'C adiciona L (membro de G2) a G1');
select lives_ok(
  $$ select adicionar_membro_obra('00000000-0000-0000-0000-00000004f001', (select id from ids where quem = 'L')) $$,
  'adicionar de novo nao falha');
select throws_ok(
  $$ select adicionar_membro_obra('00000000-0000-0000-0000-00000004f004', (select id from ids where quem = 'C2')) $$,
  '42501', null, 'C nao poe o coordenador C2 em G3');
select throws_ok(
  $$ select adicionar_membro_obra('00000000-0000-0000-0000-00000004f001', (select id from ids where quem = 'M')) $$,
  '22023', null, 'pessoa sem papel em Obras gerais nao entra');
select throws_ok(
  $$ select adicionar_membro_obra('00000000-0000-0000-0000-00000004f001', gen_random_uuid()) $$,
  '22023', null, 'pessoa inexistente nao entra');
select throws_ok(
  $$ select adicionar_membro_obra('00000000-0000-0000-0000-00000004f002', (select id from ids where quem = 'C')) $$,
  '42501', null, 'C nao adiciona em obra que nao coordena');
select throws_ok(
  $$ select adicionar_membro_obra('00000000-0000-0000-0000-00000004f003', (select id from ids where quem = 'L')) $$,
  '23505', null, 'obra da Contorno e rejeitada');

-- convidar_membro_obra: sem conta
select is(convidar_membro_obra('00000000-0000-0000-0000-00000004f001', ' Gus ', '  Gus@Email.com '), null,
  'convite sem conta devolve null');
select is(convidar_membro_obra('00000000-0000-0000-0000-00000004f004', 'Gus', 'gus@email.com'), null,
  'convite para a segunda obra');
select is(convidar_membro_obra('00000000-0000-0000-0000-00000004f001', 'Gus', 'GUS@email.com'), null,
  'convite repetido para a primeira obra');
select throws_ok(
  $$ select convidar_membro_obra('00000000-0000-0000-0000-00000004f001', 'X', 'sem-arroba') $$,
  '22023', null, 'e-mail invalido e rejeitado');
select throws_ok(
  $$ select convidar_membro_obra('00000000-0000-0000-0000-00000004f001', '  ', 'x@x.com') $$,
  '22023', null, 'nome vazio e rejeitado');
select throws_ok(
  $$ select convidar_membro_obra('00000000-0000-0000-0000-00000004f003', 'X', 'x@x.com') $$,
  '23505', null, 'convite em obra da Contorno e rejeitado');

-- convidar_membro_obra: com conta
select is(convidar_membro_obra('00000000-0000-0000-0000-00000004f001', 'Outro Nome', ' K@pdo.contro '),
  (select id from ids where quem = 'K'), 'convite de pessoa da Contorno devolve o id');
select throws_ok(
  $$ select convidar_membro_obra('00000000-0000-0000-0000-00000004f004', 'C2', 'c2@pdo.contro') $$,
  '42501', null, 'C nao convida coordenador com conta');
select is(convidar_membro_obra('00000000-0000-0000-0000-00000004f001', 'P', 'p@pdo.contro'),
  (select id from ids where quem = 'P'), 'convite de pendente devolve o id');
select throws_ok(
  $$ select convidar_membro_obra('00000000-0000-0000-0000-00000004f001', 'D', 'd@pdo.contro') $$,
  '22023', null, 'desativado so volta pelo administrador');

-- Membro de G1
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004d5","role":"authenticated"}';
select throws_ok(
  $$ select adicionar_membro_obra('00000000-0000-0000-0000-00000004f001', (select id from ids where quem = 'L')) $$,
  '42501', null, 'membro nao adiciona');
select throws_ok(
  $$ select convidar_membro_obra('00000000-0000-0000-0000-00000004f001', 'X', 'x@x.com') $$,
  '42501', null, 'membro nao convida');
select throws_ok(
  $$ select remover_da_obra('00000000-0000-0000-0000-00000004f001', (select id from ids where quem = 'L')) $$,
  '42501', null, 'membro nao remove');
-- Membro vê o Administrador pelo nome, mas não um gestor que não é administrador.
select is((select nome from pessoa where id = (select id from ids where quem = 'A')), 'Pdo A',
  'membro ve o nome do administrador');
select is((select count(*)::int from pessoa where id = (select id from ids where quem = 'Matheus')), 0,
  'membro nao ve gestor que nao e administrador');

-- L entrou em G1
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004d6","role":"authenticated"}';
select ok(contro_ve_obra('00000000-0000-0000-0000-00000004f001'), 'L passa a ver G1');

-- C remove
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004d3","role":"authenticated"}';
select throws_ok(
  $$ select remover_da_obra('00000000-0000-0000-0000-00000004f001', (select id from ids where quem = 'C2')) $$,
  '42501', null, 'coordenador nao remove coordenador');
select throws_ok(
  $$ select remover_da_obra('00000000-0000-0000-0000-00000004f001', (select id from ids where quem = 'C')) $$,
  '22023', null, 'ninguem remove a si mesmo');
select lives_ok(
  $$ select remover_da_obra('00000000-0000-0000-0000-00000004f001', (select id from ids where quem = 'J')) $$,
  'C remove o membro J de G1');
select lives_ok(
  $$ select remover_da_obra('00000000-0000-0000-0000-00000004f001', (select id from ids where quem = 'J')) $$,
  'remover quem nao participa nao faz nada');
select throws_ok(
  $$ select remover_da_obra('00000000-0000-0000-0000-00000004f001', (select id from ids where quem = 'A')) $$,
  '42501', null, 'coordenador nao remove administrador');

-- A remove coordenador
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004d2","role":"authenticated"}';
select lives_ok(
  $$ select adicionar_membro_obra('00000000-0000-0000-0000-00000004f004', (select id from ids where quem = 'C2')) $$,
  'administrador poe o coordenador C2 em G3');
select is(convidar_membro_obra('00000000-0000-0000-0000-00000004f004', 'C2', 'c2@pdo.contro'),
  (select id from ids where quem = 'C2'), 'administrador convida coordenador ja na obra: devolve o id');
select lives_ok(
  $$ select remover_da_obra('00000000-0000-0000-0000-00000004f001', (select id from ids where quem = 'C2')) $$,
  'administrador remove coordenador');
-- Saída pela RPC de Administrador da etapa 1: L fica só em G2.
select lives_ok(
  $$ select definir_acesso_geral((select id from ids where quem = 'L'), 'membro', array['00000000-0000-0000-0000-00000004f002'::uuid]) $$,
  'administrador tira L de G1 por definir_acesso_geral');

-- Membro só da Contorno continua sem ver pessoa só de Obras gerais.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004d9","role":"authenticated"}';
select is((select count(*)::int from pessoa where id = (select id from ids where quem = 'J')), 0,
  'membro da Contorno nao ve pessoa so de Obras gerais');
select is((select count(*)::int from pessoa where id = (select id from ids where quem = 'A')), 1,
  'membro da Contorno ve o administrador como antes');

reset role;

-- Participações
select is(
  (select count(*)::int from obra_participante
   where obra_id = '00000000-0000-0000-0000-00000004f001' and pessoa_id = (select id from ids where quem = 'L')),
  0, 'L saiu de G1');
select is((select papel_geral from pessoa where id = (select id from ids where quem = 'L')), 'membro', 'L continua membro');
select is(
  (select papel_geral from pessoa where id = (select id from ids where quem = 'C2')), 'coordenador',
  'adicionar e convidar nao mudam o papel do coordenador');
select is(
  (select count(*)::int from obra_participante
   where obra_id = '00000000-0000-0000-0000-00000004f004' and pessoa_id = (select id from ids where quem = 'C2')),
  1, 'C2 participa de G3');
select is(
  (select count(*)::int from obra_participante
   where obra_id = '00000000-0000-0000-0000-00000004f001' and pessoa_id = (select id from ids where quem = 'J')),
  0, 'J saiu de G1');
select is(
  (select count(*)::int from obra_participante
   where obra_id = '00000000-0000-0000-0000-00000004f002' and pessoa_id = (select id from ids where quem = 'J')),
  1, 'J continua em G2');

-- Pessoa da Contorno convidada
select is(
  (select row(papel_geral, acesso_contorno, administrador, nome)::text from pessoa where id = (select id from ids where quem = 'K')),
  row('membro', true, false, 'Pdo K')::text,
  'pessoa da Contorno vira membro, mantem a Contorno e o nome');
select is(
  (select count(*)::int from obra_participante
   where obra_id = '00000000-0000-0000-0000-00000004f001' and pessoa_id = (select id from ids where quem = 'K')),
  1, 'pessoa da Contorno entra em G1');
select is(
  (select row(ativo, acesso_contorno, papel_geral)::text from pessoa where id = (select id from ids where quem = 'P')),
  row(true, false, 'membro')::text,
  'pendente entra so nas Obras gerais, como membro');

-- Convite de Gus
select is(
  (select row(papel, nome)::text from convite_geral where email = 'gus@email.com'),
  row('membro', 'Gus')::text, 'convite normalizado como membro');
select is(
  (select obra_ids from convite_geral where email = 'gus@email.com'),
  array['00000000-0000-0000-0000-00000004f001'::uuid, '00000000-0000-0000-0000-00000004f004'::uuid],
  'convite soma as obras sem duplicar');

-- Convite de coordenador continua coordenador
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004d2","role":"authenticated"}';
select is(salvar_acesso_geral('rui@email.com', 'Rui', 'coordenador', array['00000000-0000-0000-0000-00000004f002'::uuid]), null,
  'administrador convida Rui como coordenador');
select is(convidar_membro_obra('00000000-0000-0000-0000-00000004f001', 'Rui', 'rui@email.com'), null,
  'administrador convida Rui para G1');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004d3","role":"authenticated"}';
select throws_ok(
  $$ select convidar_membro_obra('00000000-0000-0000-0000-00000004f004', 'Rui', 'rui@email.com') $$,
  '42501', null, 'C nao convida quem tem convite de coordenador');
reset role;
select is(
  (select row(papel, obra_ids)::text from convite_geral where email = 'rui@email.com'),
  row('coordenador', array['00000000-0000-0000-0000-00000004f002'::uuid, '00000000-0000-0000-0000-00000004f001'::uuid])::text,
  'convite de coordenador continua coordenador e soma a obra');

-- Gus se cadastra e já participa
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000004d8', 'Gus@Email.com');
select is(
  (select row(ativo, acesso_contorno, papel_geral, administrador)::text from pessoa where user_id = '00000000-0000-0000-0000-0000000004d8'),
  row(true, false, 'membro', false)::text,
  'Gus nasce membro, so nas Obras gerais');
select is(
  (select array_agg(op.obra_id order by op.obra_id) from obra_participante op join pessoa p on p.id = op.pessoa_id
   where p.user_id = '00000000-0000-0000-0000-0000000004d8'),
  array['00000000-0000-0000-0000-00000004f001'::uuid, '00000000-0000-0000-0000-00000004f004'::uuid],
  'Gus ja participa de G1 e G3');

-- Saída da obra: atividades
select is((select responsavel_id from obra_atividade where id = '00000000-0000-0000-0000-00000004f201'), null,
  'atividade aberta de J em G1 fica sem responsavel');
select is(
  (select row(por, antes, depois)::text from obra_atividade_evento
   where atividade_id = '00000000-0000-0000-0000-00000004f201' and tipo = 'responsavel'),
  row((select id from ids where quem = 'C'),
      jsonb_build_object('responsavel_id', (select id from ids where quem = 'J')),
      '{"responsavel_id": null, "motivo": "saiu da obra"}'::jsonb)::text,
  'evento responsavel gravado com o motivo');
select is((select responsavel_id from obra_atividade where id = '00000000-0000-0000-0000-00000004f202'),
  (select id from ids where quem = 'J'), 'atividade concluida mantem o dono');
select is((select count(*)::int from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000004f202'), 0,
  'atividade concluida sem evento');
select is((select responsavel_id from obra_atividade where id = '00000000-0000-0000-0000-00000004f203'),
  (select id from ids where quem = 'J'), 'atividade de J em outra obra nao muda');
select is((select responsavel_id from obra_atividade where id = '00000000-0000-0000-0000-00000004f204'), null,
  'definir_acesso_geral: atividade aberta de L em G1 fica sem responsavel');
select is(
  (select row(por, depois)::text from obra_atividade_evento
   where atividade_id = '00000000-0000-0000-0000-00000004f204' and tipo = 'responsavel'),
  row((select id from ids where quem = 'A'), '{"responsavel_id": null, "motivo": "saiu da obra"}'::jsonb)::text,
  'definir_acesso_geral: evento responsavel gravado');
select is((select responsavel_id from obra_atividade where id = '00000000-0000-0000-0000-00000004f205'),
  (select id from ids where quem = 'L'), 'definir_acesso_geral: atividade de L em G2 nao muda');
select is((select count(*)::int from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000004f203'), 0,
  'atividade em outra obra sem evento');

select * from finish();
rollback;
