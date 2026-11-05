-- Obras gerais · Etapa 2: planejamento da obra geral (fase, atividade,
-- subitem, data prevista com replanejamento, responsável) só para o
-- Administrador e o Coordenador participante; Membro não planeja. A Contorno
-- não muda (membro escreve direto e exclui atividade como hoje).
begin;
select plan(71);

-- Elenco: M equipe Contorno, A administrador (fora de G), C coordenador de G,
-- J membro de G, C2 coordenador de G2 (não participa de G).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000002d1', 'm@plan.contro'),
  ('00000000-0000-0000-0000-0000000002d2', 'a@plan.contro'),
  ('00000000-0000-0000-0000-0000000002d3', 'c@plan.contro'),
  ('00000000-0000-0000-0000-0000000002d4', 'j@plan.contro'),
  ('00000000-0000-0000-0000-0000000002d5', 'c2@plan.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000002d1', 'Plan M', 'equipe'),
  ('00000000-0000-0000-0000-0000000002d2', 'Plan A', 'gestor'),
  ('00000000-0000-0000-0000-0000000002d3', 'Plan C', 'equipe'),
  ('00000000-0000-0000-0000-0000000002d4', 'Plan J', 'equipe'),
  ('00000000-0000-0000-0000-0000000002d5', 'Plan C2', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000002d2';
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where user_id in ('00000000-0000-0000-0000-0000000002d3', '00000000-0000-0000-0000-0000000002d5');
update pessoa set acesso_contorno = false, papel_geral = 'membro' where user_id = '00000000-0000-0000-0000-0000000002d4';

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000002f001', 'Plan K', '2026-11-02', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000002f002', 'Plan G', '2026-11-02', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000002f003', 'Plan G2', '2026-11-02', 'x', 'geral');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000002f002', id from pessoa
  where user_id in ('00000000-0000-0000-0000-0000000002d3', '00000000-0000-0000-0000-0000000002d4');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000002f003', id from pessoa
  where user_id = '00000000-0000-0000-0000-0000000002d5';

insert into obra_fase (id, obra_id, ordem, titulo) values
  ('00000000-0000-0000-0000-00000002f101', '00000000-0000-0000-0000-00000002f001', 1, 'Fase K'),
  ('00000000-0000-0000-0000-00000002f103', '00000000-0000-0000-0000-00000002f003', 1, 'Fase G2');
insert into obra_atividade (id, obra_id, fase_id, ordem, nome) values
  ('00000000-0000-0000-0000-00000002f201', '00000000-0000-0000-0000-00000002f001', '00000000-0000-0000-0000-00000002f101', 1, 'Atividade K'),
  ('00000000-0000-0000-0000-00000002f202', '00000000-0000-0000-0000-00000002f001', '00000000-0000-0000-0000-00000002f101', 2, 'Atividade K 2'),
  ('00000000-0000-0000-0000-00000002f203', '00000000-0000-0000-0000-00000002f003', '00000000-0000-0000-0000-00000002f103', 1, 'Atividade G2');

-- ids das pessoas (nem todo mundo vê toda pessoa pela RLS)
create temp table ids as
  select split_part(nome, ' ', 2) as quem, id from pessoa
  where user_id::text like '00000000-0000-0000-0000-0000000002d_';
grant select on ids to authenticated;

set local role authenticated;

-- C (coordenador de G): planeja
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000002d3","role":"authenticated"}';
select is(contro_planeja_obra('00000000-0000-0000-0000-00000002f002'), true, 'C planeja G');
select is(contro_planeja_obra('00000000-0000-0000-0000-00000002f003'), false, 'C nao planeja G2');
select is(contro_planeja_obra(gen_random_uuid()), false, 'obra inexistente: ninguem planeja');

select is(adicionar_fase_geral('00000000-0000-0000-0000-00000002f002', '  Estrutura ', '00000000-0000-0000-0000-00000002f111'),
  '00000000-0000-0000-0000-00000002f111'::uuid, 'C cria fase');
select is(adicionar_fase_geral('00000000-0000-0000-0000-00000002f002', 'Acabamento', '00000000-0000-0000-0000-00000002f112'),
  '00000000-0000-0000-0000-00000002f112'::uuid, 'C cria segunda fase');
select is(
  (select array_agg(row(titulo, ordem, preliminar)::text order by ordem) from obra_fase where obra_id = '00000000-0000-0000-0000-00000002f002'),
  array[row('Estrutura', 1, false)::text, row('Acabamento', 2, false)::text],
  'fases com nome aparado, ordem 1 e 2, nao preliminares');
select is(adicionar_fase_geral('00000000-0000-0000-0000-00000002f002', 'Estrutura', '00000000-0000-0000-0000-00000002f111'),
  '00000000-0000-0000-0000-00000002f111'::uuid, 'p_id repetido devolve a fase');
select is((select count(*)::int from obra_fase where obra_id = '00000000-0000-0000-0000-00000002f002'), 2, 'fase repetida nao duplica');
select throws_ok($$ select adicionar_fase_geral('00000000-0000-0000-0000-00000002f002', '   ') $$,
  '22023', null, 'fase sem nome e recusada');

select is(
  adicionar_atividade_geral('00000000-0000-0000-0000-00000002f002', '00000000-0000-0000-0000-00000002f111',
    '  Laje  ', (select id from ids where quem = 'J'), '2026-11-20',
    '[{"id":"00000000-0000-0000-0000-00000002f221","nome":" Forma ","data_prevista":"2026-11-12"},
      {"id":"00000000-0000-0000-0000-00000002f222","nome":"Concretagem","data_prevista":null}]'::jsonb,
    '00000000-0000-0000-0000-00000002f211'),
  '00000000-0000-0000-0000-00000002f211'::uuid, 'C cria atividade com 2 subitens');
select is(
  (select row(nome, ordem, data_prevista, duracao_du, responsavel_id, replanejamentos, pai_id)::text
   from obra_atividade where id = '00000000-0000-0000-0000-00000002f211'),
  row('Laje', 1, '2026-11-20'::date, 1, (select id from ids where quem = 'J'), 0, null::uuid)::text,
  'atividade gravada: nome aparado, ordem 1, data, duracao padrao, responsavel');
select is(
  (select array_agg(row(nome, ordem, data_prevista, fase_id)::text order by ordem)
   from obra_atividade where pai_id = '00000000-0000-0000-0000-00000002f211'),
  array[row('Forma', 1, '2026-11-12'::date, '00000000-0000-0000-0000-00000002f111'::uuid)::text,
        row('Concretagem', 2, null::date, '00000000-0000-0000-0000-00000002f111'::uuid)::text],
  'subitens com pai, ordem 1..N, data e mesma fase');
select is(
  (select depois from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000002f211' and tipo = 'criada'),
  jsonb_build_object('nome', 'Laje', 'data_prevista', '2026-11-20', 'responsavel_id', (select id from ids where quem = 'J')),
  'evento criada com nome, data e responsavel');
select is(
  adicionar_atividade_geral('00000000-0000-0000-0000-00000002f002', '00000000-0000-0000-0000-00000002f111',
    'Laje', null, null, '[]', '00000000-0000-0000-0000-00000002f211'),
  '00000000-0000-0000-0000-00000002f211'::uuid, 'p_id repetido devolve a atividade');
select is((select count(*)::int from obra_atividade where obra_id = '00000000-0000-0000-0000-00000002f002'), 3,
  'atividade repetida nao duplica (1 + 2 subitens)');
select throws_ok($$ select adicionar_atividade_geral('00000000-0000-0000-0000-00000002f002',
    '00000000-0000-0000-0000-00000002f103', 'X', null, null) $$,
  '23503', null, 'fase de outra obra e recusada');
select throws_ok($$ select adicionar_atividade_geral('00000000-0000-0000-0000-00000002f002',
    '00000000-0000-0000-0000-00000002f111', '  ', null, null) $$,
  '22023', null, 'atividade sem nome e recusada');
select throws_ok($$ select adicionar_atividade_geral('00000000-0000-0000-0000-00000002f002',
    '00000000-0000-0000-0000-00000002f111', 'X', null, null, '[{"nome":" "}]') $$,
  '22023', null, 'subitem sem nome e recusado');
select throws_ok($$ select adicionar_atividade_geral('00000000-0000-0000-0000-00000002f002',
    '00000000-0000-0000-0000-00000002f111', 'X', (select id from ids where quem = 'C2'), null) $$,
  '22023', null, 'responsavel que nao participa e recusado');
select lives_ok($$ select adicionar_atividade_geral('00000000-0000-0000-0000-00000002f002',
    '00000000-0000-0000-0000-00000002f112', 'Pintura', (select id from ids where quem = 'A'), null, '[]',
    '00000000-0000-0000-0000-00000002f212') $$,
  'Administrador (fora da obra) pode ser responsavel');

-- definir_data_prevista
select lives_ok($$ select definir_data_prevista('00000000-0000-0000-0000-00000002f212', '2026-11-16') $$, 'primeira data');
select is(
  (select row(data_prevista, data_prevista_original, replanejamentos)::text from obra_atividade where id = '00000000-0000-0000-0000-00000002f212'),
  row('2026-11-16'::date, null::date, 0)::text, 'primeira data nao conta replanejamento');
select is(
  (select array_agg(tipo order by em) from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000002f212' and tipo <> 'criada'),
  array['data_definida'], 'primeira data grava data_definida');
select lives_ok($$ select definir_data_prevista('00000000-0000-0000-0000-00000002f212', '2026-11-18', '  Chuva ') $$, 'segunda data');
select is(
  (select row(data_prevista, data_prevista_original, replanejamentos)::text from obra_atividade where id = '00000000-0000-0000-0000-00000002f212'),
  row('2026-11-18'::date, '2026-11-16'::date, 1)::text, 'segunda data: 1 replanejamento e original a primeira');
select is(
  (select row(antes, depois)::text from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000002f212' and tipo = 'replanejada'),
  row('{"data": "2026-11-16"}'::jsonb, '{"data": "2026-11-18", "motivo": "Chuva"}'::jsonb)::text,
  'evento replanejada com antes e depois (motivo aparado)');
select lives_ok($$ select definir_data_prevista('00000000-0000-0000-0000-00000002f212', '2026-11-23') $$, 'terceira data');
select is(
  (select row(data_prevista, data_prevista_original, replanejamentos)::text from obra_atividade where id = '00000000-0000-0000-0000-00000002f212'),
  row('2026-11-23'::date, '2026-11-16'::date, 2)::text, 'terceira data: 2 replanejamentos, original ainda a primeira');
select lives_ok($$ select definir_data_prevista('00000000-0000-0000-0000-00000002f212', '2026-11-23') $$, 'mesma data');
select is(
  (select row(replanejamentos, (select count(*) from obra_atividade_evento e where e.atividade_id = a.id))::text
   from obra_atividade a where id = '00000000-0000-0000-0000-00000002f212'),
  row(2, 4::bigint)::text, 'mesma data: nada muda e nenhum evento novo');
select throws_ok($$ select definir_data_prevista('00000000-0000-0000-0000-00000002f212', null) $$,
  '22023', null, 'data nula e recusada');
select throws_ok($$ select definir_data_prevista(gen_random_uuid(), '2026-11-23') $$,
  '23503', null, 'item inexistente e recusado');

-- Atividade concluída: só troca a data
reset role;
update obra_atividade set concluida_em = now() where id = '00000000-0000-0000-0000-00000002f212';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000002d3","role":"authenticated"}';
select lives_ok($$ select definir_data_prevista('00000000-0000-0000-0000-00000002f212', '2026-11-25') $$, 'data em atividade concluida');
select is(
  (select row(data_prevista, data_prevista_original, replanejamentos)::text from obra_atividade where id = '00000000-0000-0000-0000-00000002f212'),
  row('2026-11-25'::date, '2026-11-16'::date, 2)::text, 'concluida: replanejamentos nao muda');
select is(
  (select depois from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000002f212'
   and tipo = 'data_definida' and depois ->> 'data' = '2026-11-25'),
  '{"data": "2026-11-25"}'::jsonb, 'concluida grava data_definida');
select throws_ok($$ select adicionar_subitem_geral('00000000-0000-0000-0000-00000002f212', 'Retoque', null) $$,
  '23503', null, 'subitem em atividade concluida e recusado');

-- Subitens
select is(adicionar_subitem_geral('00000000-0000-0000-0000-00000002f211', ' Cura ', '2026-11-19', '00000000-0000-0000-0000-00000002f223'),
  '00000000-0000-0000-0000-00000002f223'::uuid, 'C adiciona subitem');
select is(
  (select row(nome, ordem, data_prevista, fase_id)::text from obra_atividade where id = '00000000-0000-0000-0000-00000002f223'),
  row('Cura', 3, '2026-11-19'::date, '00000000-0000-0000-0000-00000002f111'::uuid)::text,
  'subitem no fim, com data e fase do pai');
select is(adicionar_subitem_geral('00000000-0000-0000-0000-00000002f211', 'Cura', '2026-11-19', '00000000-0000-0000-0000-00000002f223'),
  '00000000-0000-0000-0000-00000002f223'::uuid, 'subitem repetido devolve o id');
select throws_ok($$ select adicionar_subitem_geral('00000000-0000-0000-0000-00000002f221', 'Neto', null) $$,
  '23503', null, 'subitem de subitem e recusado');
select lives_ok($$ select editar_subitem_geral('00000000-0000-0000-0000-00000002f221', ' Forma e escora ', '2026-11-13') $$,
  'C edita subitem');
select is(
  (select row(nome, data_prevista, data_prevista_original, replanejamentos)::text from obra_atividade where id = '00000000-0000-0000-0000-00000002f221'),
  row('Forma e escora', '2026-11-13'::date, '2026-11-12'::date, 1)::text,
  'editar subitem muda nome e data e replaneja');
select is(
  (select array_agg(tipo order by tipo) from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000002f221'),
  array['editada', 'replanejada'], 'editar subitem grava editada e replanejada');
select lives_ok($$ select editar_subitem_geral('00000000-0000-0000-0000-00000002f222', 'Concretagem', '2026-11-17') $$,
  'subitem sem data ganha a primeira');
select is(
  (select row(data_prevista, replanejamentos, (select array_agg(tipo) from obra_atividade_evento e where e.atividade_id = a.id))::text
   from obra_atividade a where id = '00000000-0000-0000-0000-00000002f222'),
  row('2026-11-17'::date, 0, array['data_definida'])::text,
  'nome igual nao grava editada; primeira data nao replaneja');

-- Responsável
select lives_ok($$ select definir_responsavel_atividade('00000000-0000-0000-0000-00000002f211', (select id from ids where quem = 'A')) $$,
  'C troca o responsavel para o Administrador');
select is(
  (select row(antes, depois)::text from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000002f211' and tipo = 'responsavel'),
  row(jsonb_build_object('responsavel_id', (select id from ids where quem = 'J')),
      jsonb_build_object('responsavel_id', (select id from ids where quem = 'A')))::text,
  'evento responsavel com antes e depois');
select throws_ok($$ select definir_responsavel_atividade('00000000-0000-0000-0000-00000002f211', (select id from ids where quem = 'C2')) $$,
  '22023', null, 'responsavel de fora da obra e recusado');
select lives_ok($$ select definir_responsavel_atividade('00000000-0000-0000-0000-00000002f211', null) $$, 'null tira o responsavel');
select is((select responsavel_id from obra_atividade where id = '00000000-0000-0000-0000-00000002f211'), null, 'sem responsavel');

-- Prestador em obra geral: só aparado, sem sugestao
update obra_atividade set prestador = '  Concreteira   Alfa ' where id = '00000000-0000-0000-0000-00000002f211';
select is((select prestador from obra_atividade where id = '00000000-0000-0000-0000-00000002f211'), 'Concreteira Alfa',
  'prestador em obra geral aparado e com espacos unicos');

-- Guarda: referência a item de outra obra
select throws_ok($$ insert into obra_mapa_libera (obra_id, mapa_id, atividade_id) values
    ('00000000-0000-0000-0000-00000002f002', '00000000-0000-0000-0000-00000002f211', '00000000-0000-0000-0000-00000002f201') $$,
  '42501', null, 'guarda: ligacao com atividade de outra obra e recusada');

-- J (membro de G): não planeja
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000002d4","role":"authenticated"}';
select is(contro_planeja_obra('00000000-0000-0000-0000-00000002f002'), false, 'J nao planeja G');
select throws_ok($$ select adicionar_fase_geral('00000000-0000-0000-0000-00000002f002', 'X') $$, '42501', null, 'J nao cria fase');
select throws_ok($$ select adicionar_atividade_geral('00000000-0000-0000-0000-00000002f002', '00000000-0000-0000-0000-00000002f111', 'X', null, null) $$,
  '42501', null, 'J nao cria atividade');
select throws_ok($$ select adicionar_subitem_geral('00000000-0000-0000-0000-00000002f211', 'X', null) $$, '42501', null, 'J nao cria subitem');
select throws_ok($$ select editar_subitem_geral('00000000-0000-0000-0000-00000002f221', 'X', '2026-11-30') $$, '42501', null, 'J nao edita subitem');
select throws_ok($$ select definir_data_prevista('00000000-0000-0000-0000-00000002f211', '2026-11-30') $$, '42501', null, 'J nao muda data');
select throws_ok($$ select definir_responsavel_atividade('00000000-0000-0000-0000-00000002f211', null) $$, '42501', null, 'J nao troca responsavel');
select throws_ok($$ select excluir_atividade_obra('00000000-0000-0000-0000-00000002f211') $$, '42501', null, 'J nao exclui atividade');
select is_empty($$ update obra_atividade set data_prevista = '2026-12-01' where id = '00000000-0000-0000-0000-00000002f211' returning id $$,
  'J nao muda data direto (RLS)');
select throws_ok($$ insert into obra_fase (obra_id, ordem, titulo) values ('00000000-0000-0000-0000-00000002f002', 9, 'X') $$,
  '42501', null, 'J nao insere fase direto (RLS)');

-- C2 (coordenador de G2): não planeja G
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000002d5","role":"authenticated"}';
select throws_ok($$ select adicionar_fase_geral('00000000-0000-0000-0000-00000002f002', 'X') $$, '42501', null, 'C2 nao cria fase em G');
select throws_ok($$ select definir_data_prevista('00000000-0000-0000-0000-00000002f211', '2026-11-30') $$, '42501', null, 'C2 nao muda data em G');

-- A (administrador): obra Contorno não passa pelas RPCs gerais; exclui e restaura em G
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000002d2","role":"authenticated"}';
select throws_ok($$ select adicionar_fase_geral('00000000-0000-0000-0000-00000002f001', 'X') $$, '23505', null, 'obra Contorno: 23505');
select throws_ok($$ select definir_data_prevista('00000000-0000-0000-0000-00000002f201', '2026-11-30') $$, '23505', null, 'atividade Contorno: 23505');
select lives_ok($$ select excluir_atividade_obra('00000000-0000-0000-0000-00000002f211') $$, 'A exclui atividade de G');
select lives_ok($$ select restaurar_atividade_obra('00000000-0000-0000-0000-00000002f211') $$, 'A restaura atividade de G');

-- M (Contorno): sem mudança
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000002d1","role":"authenticated"}';
select results_eq($$ update obra_atividade set nome = 'Atividade K renomeada' where id = '00000000-0000-0000-0000-00000002f201' returning 1 $$,
  $$ values (1) $$, 'M ainda renomeia atividade de K direto');
select lives_ok($$ select excluir_atividade_obra('00000000-0000-0000-0000-00000002f202') $$, 'M ainda exclui atividade de K');
update obra_atividade set prestador = '  Concreteira   Alfa ' where id = '00000000-0000-0000-0000-00000002f201';

reset role;
select is((select usos from sugestao where tipo = 'prestador' and texto = 'Concreteira Alfa'), 1,
  'prestador da Contorno cria a sugestao com 1 uso (a obra geral nao criou)');

select * from finish();
rollback;
