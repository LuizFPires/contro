-- Obras gerais · Etapa 2, ajustes da revisão final:
-- A) funções de planejamento da Contorno recusam obra geral (23505), mesmo
--    para quem tem acesso à Contorno e é Membro da obra geral;
-- B/C) Desfazer da data volta exatamente (desfazer_data_prevista) e item
--    aberto com data não volta a "sem data";
-- D) Membro de obra geral não escreve direto no Mapa de coleta, providência
--    e dependência, nem restaura atividade.
begin;
select plan(64);

-- Elenco: D Contorno + Membro de G, C coordenador de G, A administrador,
-- J membro de G (só obra geral), M equipe Contorno.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006a1', 'd@ajuste.contro'),
  ('00000000-0000-0000-0000-0000000006a2', 'c@ajuste.contro'),
  ('00000000-0000-0000-0000-0000000006a3', 'a@ajuste.contro'),
  ('00000000-0000-0000-0000-0000000006a4', 'j@ajuste.contro'),
  ('00000000-0000-0000-0000-0000000006a5', 'm@ajuste.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000006a1', 'Ajuste D', 'equipe'),
  ('00000000-0000-0000-0000-0000000006a2', 'Ajuste C', 'equipe'),
  ('00000000-0000-0000-0000-0000000006a3', 'Ajuste A', 'gestor'),
  ('00000000-0000-0000-0000-0000000006a4', 'Ajuste J', 'equipe'),
  ('00000000-0000-0000-0000-0000000006a5', 'Ajuste M', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set papel_geral = 'membro' where user_id = '00000000-0000-0000-0000-0000000006a1';
update pessoa set acesso_contorno = false, papel_geral = 'coordenador' where user_id = '00000000-0000-0000-0000-0000000006a2';
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000006a3';
update pessoa set acesso_contorno = false, papel_geral = 'membro' where user_id = '00000000-0000-0000-0000-0000000006a4';

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000006f001', 'Ajuste K', '2026-11-02', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000006f002', 'Ajuste G', '2026-11-02', 'x', 'geral');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000006f002', id from pessoa
  where user_id in ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006a2',
                    '00000000-0000-0000-0000-0000000006a4');

insert into obra_fase (id, obra_id, ordem, titulo, preliminar) values
  ('00000000-0000-0000-0000-00000006f101', '00000000-0000-0000-0000-00000006f001', 1, 'Mapa de coleta', true),
  ('00000000-0000-0000-0000-00000006f102', '00000000-0000-0000-0000-00000006f001', 2, 'Fase K', false),
  ('00000000-0000-0000-0000-00000006f103', '00000000-0000-0000-0000-00000006f002', 1, 'Mapa de coleta', true),
  ('00000000-0000-0000-0000-00000006f104', '00000000-0000-0000-0000-00000006f002', 2, 'Fase G', false);
insert into obra_atividade (id, obra_id, fase_id, ordem, nome, mapa_antecedencia_du) values
  ('00000000-0000-0000-0000-00000006f201', '00000000-0000-0000-0000-00000006f001', '00000000-0000-0000-0000-00000006f101', 1, 'Mapa K', 5),
  ('00000000-0000-0000-0000-00000006f202', '00000000-0000-0000-0000-00000006f001', '00000000-0000-0000-0000-00000006f102', 1, 'Atividade K', null),
  ('00000000-0000-0000-0000-00000006f203', '00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f103', 1, 'Mapa G', 5),
  ('00000000-0000-0000-0000-00000006f204', '00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f104', 1, 'Atividade G', null),
  ('00000000-0000-0000-0000-00000006f205', '00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f104', 2, 'Atividade G 2', null),
  ('00000000-0000-0000-0000-00000006f206', '00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f104', 3, 'Atividade G 3', null),
  ('00000000-0000-0000-0000-00000006f207', '00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f104', 4, 'Atividade G excluida', null);
update obra_atividade set deleted_at = now() where id = '00000000-0000-0000-0000-00000006f207';
insert into obra_providencia (id, obra_id, atividade_id, tipo, descricao) values
  ('00000000-0000-0000-0000-00000006f301', '00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f204', 'compra', 'Cimento');
insert into obra_dependencia (obra_id, atividade_id, predecessora_id) values
  ('00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f205', '00000000-0000-0000-0000-00000006f204');
insert into obra_mapa_libera (obra_id, mapa_id, atividade_id) values
  ('00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f203', '00000000-0000-0000-0000-00000006f204');
-- A validação da proposta pede a pessoa logada; a semente entra sem ela.
alter table mapa_proposta disable trigger mapa_proposta_validar;
insert into mapa_proposta (id, obra_id, atividade_id, contratado, descricao, criado_por) values
  ('00000000-0000-0000-0000-00000006f401', '00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f203',
   'Fornecedor', 'Proposta', '00000000-0000-0000-0000-0000000006a3');
alter table mapa_proposta enable trigger mapa_proposta_validar;

-- Ids dos eventos de data devolvidos pelas RPCs.
create temp table evs (k text primary key, id uuid);
grant select, insert on evs to authenticated;

set local role authenticated;

-- A) D (acesso à Contorno e Membro de G): as funções da Contorno recusam G.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}';
select throws_ok($$ select adicionar_atividade_obra('00000000-0000-0000-0000-00000006f002',
    '00000000-0000-0000-0000-00000006f104', 'X', 1) $$, '23505', null, 'D nao adiciona atividade em G pela Contorno');
select throws_ok($$ select ajustar_inicio('00000000-0000-0000-0000-00000006f204', '2026-11-20') $$,
  '23505', null, 'D nao ajusta inicio em G');
select throws_ok($$ select adicionar_mapa_obra('00000000-0000-0000-0000-00000006f002', 'X', 1, 1,
    array['00000000-0000-0000-0000-00000006f204'::uuid]) $$, '23505', null, 'D nao adiciona mapa em G');
select throws_ok($$ select atualizar_prazos_atividades('00000000-0000-0000-0000-00000006f002', '[]') $$,
  '23505', null, 'D nao grava prazos de atividades de G');
select throws_ok($$ select atualizar_prazos_providencias('00000000-0000-0000-0000-00000006f002', '[]') $$,
  '23505', null, 'D nao grava prazos de providencias de G');
select throws_ok($$ select fixar_entrega_original('00000000-0000-0000-0000-00000006f002', '2026-12-01') $$,
  '23505', null, 'D nao fixa a entrega de G');
select throws_ok($$ select aplicar_plano_recuperacao('00000000-0000-0000-0000-00000006f002', '2026-12-01') $$,
  '23505', null, 'D nao aplica plano de recuperacao em G');
select is((select inicio_manual from obra_atividade where id = '00000000-0000-0000-0000-00000006f204'), null,
  'G sem inicio ajustado');

-- Contorno segue igual para D.
select is(adicionar_atividade_obra('00000000-0000-0000-0000-00000006f001', '00000000-0000-0000-0000-00000006f102',
    'Nova K', 2, '{}', '00000000-0000-0000-0000-00000006f208'),
  '00000000-0000-0000-0000-00000006f208'::uuid, 'D adiciona atividade em K');
select lives_ok($$ select ajustar_inicio('00000000-0000-0000-0000-00000006f202', '2026-11-20') $$, 'D ajusta inicio em K');
select is((select inicio_manual from obra_atividade where id = '00000000-0000-0000-0000-00000006f202'), '2026-11-20'::date,
  'inicio de K ajustado');
select lives_ok($$ select fixar_entrega_original('00000000-0000-0000-0000-00000006f001', '2026-12-01') $$, 'D fixa a entrega de K');
select is(atualizar_prazos_atividades('00000000-0000-0000-0000-00000006f001',
    '[{"id":"00000000-0000-0000-0000-00000006f202","ate":"2026-11-25"}]'), 1, 'D grava prazo de atividade de K');

-- B/C) C (coordenador de G): data com evento devolvido e Desfazer exato.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}';
insert into evs select 'e1', definir_data_prevista('00000000-0000-0000-0000-00000006f204', '2026-11-16');
select is((select tipo from obra_atividade_evento where id = (select id from evs where k = 'e1')), 'data_definida',
  'primeira data devolve o id do evento data_definida');
select is((select antes from obra_atividade_evento where id = (select id from evs where k = 'e1')),
  '{"data": null, "data_prevista_original": null, "replanejamentos": 0}'::jsonb,
  'antes guarda data, original e contador');
insert into evs select 'e2', definir_data_prevista('00000000-0000-0000-0000-00000006f204', '2026-11-18', 'Chuva');
select is(
  (select row(data_prevista, data_prevista_original, replanejamentos)::text from obra_atividade where id = '00000000-0000-0000-0000-00000006f204'),
  row('2026-11-18'::date, '2026-11-16'::date, 1)::text, 'segunda data replaneja');
select is((select antes from obra_atividade_evento where id = (select id from evs where k = 'e2')),
  '{"data": "2026-11-16", "data_prevista_original": null, "replanejamentos": 0}'::jsonb,
  'replanejada guarda o estado anterior');
select is(definir_data_prevista('00000000-0000-0000-0000-00000006f204', '2026-11-18'), null::uuid,
  'mesma data devolve null');
select throws_ok($$ select definir_data_prevista('00000000-0000-0000-0000-00000006f204', null) $$,
  '22023', 'Não dá para tirar a data; use Desfazer', 'item aberto com data nao volta a sem data');
select is(definir_data_prevista('00000000-0000-0000-0000-00000006f205', null), null::uuid,
  'data nula em item sem data: nada muda');

select throws_ok(format('select desfazer_data_prevista(%L)', (select id from evs where k = 'e1')),
  '22023', 'Não dá mais para desfazer', 'evento que nao e o ultimo de data nao desfaz');
select lives_ok(format('select desfazer_data_prevista(%L)', (select id from evs where k = 'e2')), 'C desfaz a segunda data');
select is(
  (select row(data_prevista, data_prevista_original, replanejamentos)::text from obra_atividade where id = '00000000-0000-0000-0000-00000006f204'),
  row('2026-11-16'::date, null::date, 0)::text, 'Desfazer volta data, original e contador exatamente');
select is(
  (select row(antes, depois)::text from obra_atividade_evento
   where atividade_id = '00000000-0000-0000-0000-00000006f204' and tipo = 'data_desfeita'),
  row('{"data": "2026-11-18", "data_prevista_original": "2026-11-16", "replanejamentos": 1}'::jsonb,
      jsonb_build_object('data', '2026-11-16', 'data_prevista_original', null, 'replanejamentos', 0,
                         'evento_id', (select id from evs where k = 'e2')))::text,
  'grava data_desfeita com antes e depois');
select throws_ok(format('select desfazer_data_prevista(%L)', (select id from evs where k = 'e2')),
  '22023', 'Não dá mais para desfazer', 'desfazer de novo e recusado');
select throws_ok(format('select desfazer_data_prevista(%L)', (select id from evs where k = 'e1')),
  '22023', 'Não dá mais para desfazer', 'depois de desfazer, o evento anterior nao desfaz');
select throws_ok(format('select desfazer_data_prevista(%L)',
    (select id from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000006f204' and tipo = 'data_desfeita')),
  '22023', 'Não dá mais para desfazer', 'evento que nao e de data nao desfaz');
select throws_ok($$ select desfazer_data_prevista(gen_random_uuid()) $$,
  '22023', 'Não dá mais para desfazer', 'evento inexistente nao desfaz');

-- Desfazer de outra pessoa: recusado; o autor ainda desfaz.
insert into evs select 'e3', definir_data_prevista('00000000-0000-0000-0000-00000006f204', '2026-11-20');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006a3","role":"authenticated"}';
select throws_ok(format('select desfazer_data_prevista(%L)', (select id from evs where k = 'e3')),
  '22023', 'Não dá mais para desfazer', 'A nao desfaz a data que C mudou');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006a4","role":"authenticated"}';
select throws_ok(format('select desfazer_data_prevista(%L)', (select id from evs where k = 'e3')),
  '42501', null, 'J (membro) nao desfaz');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}';
select lives_ok(format('select desfazer_data_prevista(%L)', (select id from evs where k = 'e3')), 'C desfaz a propria data');
select is(
  (select row(data_prevista, data_prevista_original, replanejamentos)::text from obra_atividade where id = '00000000-0000-0000-0000-00000006f204'),
  row('2026-11-16'::date, null::date, 0)::text, 'de volta a primeira data, sem replanejamento');

-- Depois de 10 minutos: recusado.
insert into evs select 'e4', definir_data_prevista('00000000-0000-0000-0000-00000006f206', '2026-11-19');
reset role;
update obra_atividade_evento set em = now() - interval '11 minutes' where id = (select id from evs where k = 'e4');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}';
select throws_ok(format('select desfazer_data_prevista(%L)', (select id from evs where k = 'e4')),
  '22023', 'Não dá mais para desfazer', 'depois de 10 min nao desfaz');
reset role;
update obra_atividade_evento set em = now() - interval '9 minutes' where id = (select id from evs where k = 'e4');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}';
select lives_ok(format('select desfazer_data_prevista(%L)', (select id from evs where k = 'e4')), 'antes de 10 min desfaz');
select is(
  (select row(data_prevista, data_prevista_original, replanejamentos)::text from obra_atividade where id = '00000000-0000-0000-0000-00000006f206'),
  row(null::date, null::date, 0)::text, 'Desfazer da primeira data volta a sem data');

-- Subitem: editar devolve o id do evento da data; Desfazer volta exatamente.
select is(adicionar_subitem_geral('00000000-0000-0000-0000-00000006f205', 'Forma', '2026-11-12', '00000000-0000-0000-0000-00000006f209'),
  '00000000-0000-0000-0000-00000006f209'::uuid, 'C cria subitem com data');
select is(editar_subitem_geral('00000000-0000-0000-0000-00000006f209', 'Forma nova', '2026-11-12'), null::uuid,
  'editar so o nome devolve null');
insert into evs select 's1', editar_subitem_geral('00000000-0000-0000-0000-00000006f209', 'Forma e escora', '2026-11-13');
select is((select tipo from obra_atividade_evento where id = (select id from evs where k = 's1')), 'replanejada',
  'editar subitem devolve o id do evento replanejada');
select throws_ok($$ select editar_subitem_geral('00000000-0000-0000-0000-00000006f209', 'Forma e escora', null) $$,
  '22023', 'Não dá para tirar a data; use Desfazer', 'subitem aberto com data nao volta a sem data');
select lives_ok(format('select desfazer_data_prevista(%L)', (select id from evs where k = 's1')), 'C desfaz a data do subitem');
select lives_ok($$ select editar_subitem_geral('00000000-0000-0000-0000-00000006f209', 'Forma nova', '2026-11-12') $$,
  'e volta o nome com a data restaurada');
select is(
  (select row(nome, data_prevista, data_prevista_original, replanejamentos)::text from obra_atividade where id = '00000000-0000-0000-0000-00000006f209'),
  row('Forma nova', '2026-11-12'::date, null::date, 0)::text, 'subitem como antes da edicao');

-- Item concluído: data nula ainda pode (só data_definida, sem contar).
reset role;
update obra_atividade set concluida_em = now() where id = '00000000-0000-0000-0000-00000006f204';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}';
select isnt(definir_data_prevista('00000000-0000-0000-0000-00000006f204', null), null::uuid, 'concluida: data nula grava evento');
select is(
  (select row(data_prevista, replanejamentos)::text from obra_atividade where id = '00000000-0000-0000-0000-00000006f204'),
  row(null::date, 0)::text, 'concluida: sem data e sem replanejamento');

-- D6) Mapa de coleta: C (planeja G) escreve direto.
select lives_ok($$ insert into obra_mapa_libera (obra_id, mapa_id, atividade_id) values
    ('00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f203', '00000000-0000-0000-0000-00000006f205') $$,
  'C liga mapa de G');
-- Proposta pede acesso à Contorno (contro_nome_prestador): A planeja G e tem.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006a3","role":"authenticated"}';
select lives_ok($$ insert into mapa_proposta (obra_id, atividade_id, contratado, descricao) values
    ('00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f203', 'Outro', 'Proposta A') $$,
  'A cria proposta em G');
select results_eq($$ update mapa_proposta set descricao = 'Mudou A' where id = '00000000-0000-0000-0000-00000006f401' returning 1 $$,
  $$ values (1) $$, 'A altera proposta de G');

-- D (Contorno + Membro de G): a proposta passa a validação, mas a RLS barra.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}';
select throws_ok($$ insert into mapa_proposta (obra_id, atividade_id, contratado, descricao) values
    ('00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f203', 'Outro', 'Proposta D') $$,
  '42501', 'new row violates row-level security policy for table "mapa_proposta"', 'D nao cria proposta em G');
select is_empty($$ update mapa_proposta set descricao = 'Mudou D' where id = '00000000-0000-0000-0000-00000006f401' returning 1 $$,
  'D nao altera proposta de G');
select throws_ok($$ insert into obra_mapa_libera (obra_id, mapa_id, atividade_id) values
    ('00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f203', '00000000-0000-0000-0000-00000006f206') $$,
  '42501', null, 'D nao liga mapa de G');

-- D6/D10) J (membro de G): não escreve direto no planejamento.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006a4","role":"authenticated"}';
select throws_ok($$ insert into obra_mapa_libera (obra_id, mapa_id, atividade_id) values
    ('00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f203', '00000000-0000-0000-0000-00000006f206') $$,
  '42501', null, 'J nao liga mapa de G');
select is_empty($$ delete from obra_mapa_libera where mapa_id = '00000000-0000-0000-0000-00000006f203' returning 1 $$,
  'J nao desliga mapa de G');
select throws_ok($$ insert into obra_providencia (obra_id, atividade_id, tipo, descricao) values
    ('00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f204', 'compra', 'Areia') $$,
  '42501', null, 'J nao cria providencia em G');
select is_empty($$ update obra_providencia set descricao = 'Mudou' where id = '00000000-0000-0000-0000-00000006f301' returning 1 $$,
  'J nao altera providencia de G');
select throws_ok($$ insert into obra_dependencia (obra_id, atividade_id, predecessora_id) values
    ('00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f206', '00000000-0000-0000-0000-00000006f204') $$,
  '42501', null, 'J nao cria dependencia em G');
select is_empty($$ update obra_dependencia set defasagem_du = -1
    where atividade_id = '00000000-0000-0000-0000-00000006f205' returning 1 $$,
  'J nao altera dependencia de G');
select is_empty($$ delete from obra_dependencia where atividade_id = '00000000-0000-0000-0000-00000006f205' returning 1 $$,
  'J nao apaga dependencia de G');
select throws_ok($$ select restaurar_atividade_obra('00000000-0000-0000-0000-00000006f207') $$,
  '42501', null, 'J nao restaura atividade de G');

-- M (Contorno): Mapa de coleta como antes.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006a5","role":"authenticated"}';
select lives_ok($$ insert into obra_mapa_libera (obra_id, mapa_id, atividade_id) values
    ('00000000-0000-0000-0000-00000006f001', '00000000-0000-0000-0000-00000006f201', '00000000-0000-0000-0000-00000006f202') $$,
  'M liga mapa de K');
select lives_ok($$ insert into mapa_proposta (obra_id, atividade_id, contratado, descricao) values
    ('00000000-0000-0000-0000-00000006f001', '00000000-0000-0000-0000-00000006f201', 'Outro', 'Proposta M') $$,
  'M cria proposta em K');
select results_eq($$ update mapa_proposta set descricao = 'Mudou M' where obra_id = '00000000-0000-0000-0000-00000006f001' returning 1 $$,
  $$ values (1) $$, 'M altera proposta de K');
select results_eq($$ delete from obra_mapa_libera where mapa_id = '00000000-0000-0000-0000-00000006f201' returning 1 $$,
  $$ values (1) $$, 'M desliga mapa de K');

reset role;
select is((select count(*)::int from obra_dependencia where obra_id = '00000000-0000-0000-0000-00000006f002'), 1,
  'dependencia de G intacta');
select is((select count(*)::int from obra_mapa_libera where obra_id = '00000000-0000-0000-0000-00000006f002'), 2,
  'mapa de G: a ligacao original e a de C');

select * from finish();
rollback;
