-- Obras gerais · Etapa 4: "Reunião e avisos" por obra (config_avisos_obra),
-- providenciar_ate gravado pelo banco, ações do dia completas (atividades,
-- tarefas, pendências e providências) e lembretes de reunião por obra.
-- A Contorno não muda.
begin;
select plan(55);

-- Elenco: A administrador (e gestor da Contorno), C coordenador de G1,
-- D coordenador de G2, J membro de G1 e G2, M membro de G1, K equipe só da Contorno.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006b1', 'a@avo.contro'),
  ('00000000-0000-0000-0000-0000000006b2', 'c@avo.contro'),
  ('00000000-0000-0000-0000-0000000006b3', 'd@avo.contro'),
  ('00000000-0000-0000-0000-0000000006b4', 'j@avo.contro'),
  ('00000000-0000-0000-0000-0000000006b5', 'm@avo.contro'),
  ('00000000-0000-0000-0000-0000000006b6', 'k@avo.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000006b1', 'Avo A', 'gestor'),
  ('00000000-0000-0000-0000-0000000006b2', 'Avo C', 'equipe'),
  ('00000000-0000-0000-0000-0000000006b3', 'Avo D', 'equipe'),
  ('00000000-0000-0000-0000-0000000006b4', 'Avo J', 'equipe'),
  ('00000000-0000-0000-0000-0000000006b5', 'Avo M', 'equipe'),
  ('00000000-0000-0000-0000-0000000006b6', 'Avo K', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000006b1';
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where user_id in ('00000000-0000-0000-0000-0000000006b2', '00000000-0000-0000-0000-0000000006b3');
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id in ('00000000-0000-0000-0000-0000000006b4', '00000000-0000-0000-0000-0000000006b5');

create temp table ids as
  select split_part(nome, ' ', 2) as quem, id, user_id from pessoa
  where user_id::text like '00000000-0000-0000-0000-0000000006b_';
grant select on ids to authenticated;

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000006b001', 'Avo G1', '2031-01-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000006b002', 'Avo G2', '2031-01-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000006b004', 'Avo K', '2031-01-01', 'x', 'contorno');
-- Só estas obras contam (isola dos dados do seed e de outros testes).
update obra set status = 'pausada' where id not in (
  '00000000-0000-0000-0000-00000006b001', '00000000-0000-0000-0000-00000006b002',
  '00000000-0000-0000-0000-00000006b004');

insert into obra_participante (obra_id, pessoa_id)
  select o.id::uuid, i.id from ids i
  join (values
    ('00000000-0000-0000-0000-00000006b001', 'C'), ('00000000-0000-0000-0000-00000006b002', 'D'),
    ('00000000-0000-0000-0000-00000006b001', 'J'), ('00000000-0000-0000-0000-00000006b002', 'J'),
    ('00000000-0000-0000-0000-00000006b001', 'M')
  ) as o (id, quem) on o.quem = i.quem;

insert into obra_fase (id, obra_id, ordem, titulo) values
  ('00000000-0000-0000-0000-00000006b101', '00000000-0000-0000-0000-00000006b001', 1, 'Fase G1'),
  ('00000000-0000-0000-0000-00000006b102', '00000000-0000-0000-0000-00000006b002', 1, 'Fase G2'),
  ('00000000-0000-0000-0000-00000006b104', '00000000-0000-0000-0000-00000006b004', 1, 'Fase K');

-- Global conhecida (a do seed pode ser outra). Quarta = 3.
update config_avisos set reuniao_dia = 3, reuniao_hora = '16:00', manha_ativo = true, manha_hora = '08:00',
  antes_ativo = true, antes_min = 60, acoes_ativo = true, acoes_hora = '07:30',
  pend_alta_du = 2, pend_media_du = 4, pend_baixa_du = 6, provid_ativo = false, provid_hora = '08:00'
  where id;

-- 1) Config da obra -----------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006b2","role":"authenticated"}';
select is(config_avisos_da_obra('00000000-0000-0000-0000-00000006b001'),
  jsonb_build_object('obra_id', '00000000-0000-0000-0000-00000006b001', 'reuniao_dia', 3, 'reuniao_hora', '16:00:00',
    'manha_ativo', true, 'manha_hora', '08:00:00', 'antes_ativo', true, 'antes_min', 60,
    'acoes_ativo', true, 'acoes_hora', '07:30:00', 'pend_alta_du', 2, 'pend_media_du', 4, 'pend_baixa_du', 6,
    'provid_ativo', false, 'provid_hora', '08:00:00', 'personalizada', false),
  'sem linha: a config da obra é a global');

-- C salva a de G1 (parcial: o resto vem da efetiva).
select is(salvar_config_avisos_obra('00000000-0000-0000-0000-00000006b001',
    '{"reuniao_hora":"10:00","antes_min":30,"acoes_hora":"09:00","pend_alta_du":1}'::jsonb)
    - 'obra_id',
  jsonb_build_object('reuniao_dia', 3, 'reuniao_hora', '10:00:00',
    'manha_ativo', true, 'manha_hora', '08:00:00', 'antes_ativo', true, 'antes_min', 30,
    'acoes_ativo', true, 'acoes_hora', '09:00:00', 'pend_alta_du', 1, 'pend_media_du', 4, 'pend_baixa_du', 6,
    'provid_ativo', false, 'provid_hora', '08:00:00', 'personalizada', true),
  'Coordenador salva a config da obra dele (o que não veio fica com a efetiva)');
select is((select count(*)::int from config_avisos_obra where obra_id = '00000000-0000-0000-0000-00000006b001'), 1,
  'Coordenador lê a linha da obra dele');
select throws_ok(
  $$ select salvar_config_avisos_obra('00000000-0000-0000-0000-00000006b001', '{"antes_min":45}'::jsonb) $$,
  '22023', null, 'valor fora do CHECK → 22023');
select throws_ok(
  $$ select salvar_config_avisos_obra('00000000-0000-0000-0000-00000006b001', '{"acoes_hora":"25:00"}'::jsonb) $$,
  '22023', null, 'hora inválida → 22023');
select throws_ok(
  $$ select salvar_config_avisos_obra('00000000-0000-0000-0000-00000006b001', '{"manha_ativo":null}'::jsonb) $$,
  '22023', null, 'nulo → 22023');
select throws_ok(
  $$ insert into config_avisos_obra (obra_id, reuniao_dia, reuniao_hora, manha_ativo, manha_hora, antes_ativo,
       antes_min, acoes_ativo, acoes_hora, pend_alta_du, pend_media_du, pend_baixa_du, provid_ativo, provid_hora)
     values ('00000000-0000-0000-0000-00000006b001', 1, '10:00', true, '08:00', true, 30, true, '07:00', 2, 4, 6,
       false, '08:00') on conflict (obra_id) do nothing $$,
  '42501', null, 'escrita direta na tabela é recusada (só pela RPC)');
select throws_ok(
  $$ select salvar_config_avisos_obra('00000000-0000-0000-0000-00000006b002', '{"acoes_hora":"06:00"}'::jsonb) $$,
  '42501', null, 'Coordenador de outra obra não salva');
select throws_ok(
  $$ select salvar_config_avisos_obra('00000000-0000-0000-0000-00000006b004', '{"acoes_hora":"06:00"}'::jsonb) $$,
  '23505', null, 'obra da Contorno → 23505');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006b4","role":"authenticated"}';
select throws_ok(
  $$ select salvar_config_avisos_obra('00000000-0000-0000-0000-00000006b001', '{"acoes_hora":"06:00"}'::jsonb) $$,
  '42501', null, 'Membro não salva');
select is(config_avisos_da_obra('00000000-0000-0000-0000-00000006b001') ->> 'acoes_hora', '09:00:00',
  'Membro lê a config efetiva da obra');
select is((select count(*)::int from config_avisos_obra), 1, 'Membro vê só as linhas das obras dele');
-- Reunião da obra abre com a hora da config dela; sem linha, a da global.
select set_config('avo.r1', abrir_reuniao_geral('00000000-0000-0000-0000-00000006b001', '2031-01-08')::text, true);
select set_config('avo.r2', abrir_reuniao_geral('00000000-0000-0000-0000-00000006b002', '2031-01-08')::text, true);
select is((select hora from reuniao where id = current_setting('avo.r1')::uuid), '10:00'::time,
  'abrir_reuniao_geral usa a hora da config da obra');
select is((select hora from reuniao where id = current_setting('avo.r2')::uuid), '16:00'::time,
  'abrir_reuniao_geral sem config da obra usa a global');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006b3","role":"authenticated"}';
select throws_ok(
  $$ select salvar_config_avisos_obra('00000000-0000-0000-0000-00000006b001', '{"acoes_hora":"06:00"}'::jsonb) $$,
  '42501', null, 'Coordenador de G2 não salva a de G1');
select throws_ok(
  $$ select config_avisos_da_obra('00000000-0000-0000-0000-00000006b001') $$,
  '42501', null, 'quem não vê a obra não lê a config dela');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006b6","role":"authenticated"}';
select is((select count(*)::int from config_avisos_obra), 0, 'pessoa só da Contorno não lê config de obra geral');
reset role;

-- 2) Providências da obra geral ------------------------------------------------

-- Atv P: segunda 13/01/2031, responsável J.
insert into obra_atividade (id, obra_id, fase_id, ordem, nome, data_prevista, responsavel_id) values
  ('00000000-0000-0000-0000-00000006b201', '00000000-0000-0000-0000-00000006b001', '00000000-0000-0000-0000-00000006b101',
   1, 'Atv P', '2031-01-13', (select id from ids where quem = 'J'));

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006b2","role":"authenticated"}';
-- Mesmo quem tenta gravar outro valor fica com o calculado.
insert into obra_providencia (id, obra_id, atividade_id, tipo, descricao, antecedencia_du, manual, providenciar_ate) values
  ('00000000-0000-0000-0000-00000006b301', '00000000-0000-0000-0000-00000006b001', '00000000-0000-0000-0000-00000006b201',
   'contratacao', 'Pintor', 3, true, '2030-01-01'),
  ('00000000-0000-0000-0000-00000006b302', '00000000-0000-0000-0000-00000006b001', '00000000-0000-0000-0000-00000006b201',
   'compra', 'Tinta', 0, true, null);
select is((select providenciar_ate from obra_providencia where id = '00000000-0000-0000-0000-00000006b301'),
  '2031-01-08'::date, 'providência de 3 d.u. antes de uma segunda: quarta anterior');
select is((select providenciar_ate from obra_providencia where id = '00000000-0000-0000-0000-00000006b302'),
  '2031-01-13'::date, 'antecedência 0: a própria data');
select definir_data_prevista('00000000-0000-0000-0000-00000006b201', '2031-01-15');
select is((select providenciar_ate from obra_providencia where id = '00000000-0000-0000-0000-00000006b301'),
  '2031-01-10'::date, 'replanejar a atividade recalcula (quarta 15/01 → sexta 10/01)');
select set_config('avo.sub', adicionar_subitem_geral('00000000-0000-0000-0000-00000006b201', 'Sub P', '2031-01-20')::text, true);
select is((select providenciar_ate from obra_providencia where id = '00000000-0000-0000-0000-00000006b301'),
  '2031-01-15'::date, 'subitem novo com data mais tarde manda no prazo (segunda 20/01 → quarta 15/01)');
select editar_subitem_geral(current_setting('avo.sub')::uuid, 'Sub P', '2031-01-22');
select is((select providenciar_ate from obra_providencia where id = '00000000-0000-0000-0000-00000006b301'),
  '2031-01-17'::date, 'replanejar o subitem recalcula');
update obra_providencia set antecedencia_du = 5 where id = '00000000-0000-0000-0000-00000006b301';
select is((select providenciar_ate from obra_providencia where id = '00000000-0000-0000-0000-00000006b301'),
  '2031-01-15'::date, 'mudar a antecedência recalcula');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006b4","role":"authenticated"}';
select throws_ok(
  $$ insert into obra_providencia (obra_id, atividade_id, tipo, descricao, antecedencia_du, manual) values
     ('00000000-0000-0000-0000-00000006b001', '00000000-0000-0000-0000-00000006b201', 'compra', 'X', 1, true) $$,
  '42501', null, 'Membro não cria providência');
reset role;
-- Excluir o subitem (exclusão lógica) devolve o prazo à data da atividade.
update obra_atividade set deleted_at = now() where id = current_setting('avo.sub')::uuid;
select is((select providenciar_ate from obra_providencia where id = '00000000-0000-0000-0000-00000006b301'),
  '2031-01-08'::date, 'excluir o subitem recalcula (volta a quarta 15/01 − 5 d.u.)');

-- Contorno: o banco não mexe no providenciar_ate (o app grava).
insert into obra_atividade (id, obra_id, fase_id, ordem, nome) values
  ('00000000-0000-0000-0000-00000006b211', '00000000-0000-0000-0000-00000006b004', '00000000-0000-0000-0000-00000006b104', 1, 'Atv K');
insert into obra_providencia (id, obra_id, atividade_id, tipo, descricao, antecedencia_du, providenciar_ate) values
  ('00000000-0000-0000-0000-00000006b311', '00000000-0000-0000-0000-00000006b004', '00000000-0000-0000-0000-00000006b211',
   'compra', 'Piso', 3, '2031-02-02');
update obra_providencia set antecedencia_du = 4 where id = '00000000-0000-0000-0000-00000006b311';
select is((select providenciar_ate from obra_providencia where id = '00000000-0000-0000-0000-00000006b311'),
  '2031-02-02'::date, 'Contorno: providenciar_ate fica como o app gravou');

-- 3) Ações do dia ----------------------------------------------------------------
-- Quarta 08/01/2031. G1 (config própria: ações 09:00, pendência alta 1 d.u.);
-- G2 sem linha (global: 07:30, alta 2 d.u.).
-- J: G1 Atv J1 atrasada (07/01) com tarefa vinculada aberta de hoje (conta a
--    tarefa); G1 pendência alta de segunda 06/01 (1 d.u. → 07/01, atrasada);
--    G2 Atv J2 atrasada (06/01); G2 providência da Atv J3 (sexta 10/01 − 2 d.u.
--    = hoje). Total: 2 atrasadas e 2 vencem hoje.
-- M: G1 Atv M1 hoje.
-- Atv P (prazo 15/01) e a providência dela (08/01, mas tem tarefa vinculada) não contam.
insert into obra_atividade (id, obra_id, fase_id, ordem, nome, data_prevista, responsavel_id) values
  ('00000000-0000-0000-0000-00000006b221', '00000000-0000-0000-0000-00000006b001', '00000000-0000-0000-0000-00000006b101',
   2, 'Atv J1', '2031-01-07', (select id from ids where quem = 'J')),
  ('00000000-0000-0000-0000-00000006b222', '00000000-0000-0000-0000-00000006b002', '00000000-0000-0000-0000-00000006b102',
   1, 'Atv J2', '2031-01-06', (select id from ids where quem = 'J')),
  ('00000000-0000-0000-0000-00000006b223', '00000000-0000-0000-0000-00000006b002', '00000000-0000-0000-0000-00000006b102',
   2, 'Atv J3', '2031-01-10', (select id from ids where quem = 'J')),
  ('00000000-0000-0000-0000-00000006b224', '00000000-0000-0000-0000-00000006b001', '00000000-0000-0000-0000-00000006b101',
   3, 'Atv M1', '2031-01-08', (select id from ids where quem = 'M'));
insert into tarefa (obra_id, texto, prazo, responsavel_id, vinculo_tipo, vinculo_id) values
  ('00000000-0000-0000-0000-00000006b001', 'Cobrar J1', '2031-01-08', (select id from ids where quem = 'J'),
   'atividade', '00000000-0000-0000-0000-00000006b221'),
  ('00000000-0000-0000-0000-00000006b001', 'Contratar pintor', '2031-01-20', (select id from ids where quem = 'C'),
   'providencia', '00000000-0000-0000-0000-00000006b301');
insert into pendencia (obra_id, titulo, criticidade, apontada_em, responsavel_id) values
  ('00000000-0000-0000-0000-00000006b001', 'Trinca', 'alta', '2031-01-06 12:00-03', (select id from ids where quem = 'J'));
insert into obra_providencia (obra_id, atividade_id, tipo, descricao, antecedencia_du) values
  ('00000000-0000-0000-0000-00000006b002', '00000000-0000-0000-0000-00000006b223', 'locacao', 'Andaime', 2);
-- Tarefa e pendência fechadas/excluídas não contam.
insert into tarefa (obra_id, texto, prazo, responsavel_id, status, deleted_at) values
  ('00000000-0000-0000-0000-00000006b002', 'Feita', '2031-01-06', (select id from ids where quem = 'J'), 'feita', null),
  ('00000000-0000-0000-0000-00000006b002', 'Excluída', '2031-01-06', (select id from ids where quem = 'J'), 'aberta', now());

select is(gerar_avisos_gerais('2031-01-08 07:20-03'), 0, 'antes de qualquer horário: nada');
select gerar_avisos_gerais('2031-01-08 07:40-03');
select is((select count(*)::int from aviso_disparo where dia = '2031-01-08' and tipo = 'reuniao_manha_geral'),
  0, 'quarta 07:40 (antes da manhã): sem lembrete de reunião');
select results_eq(
  $$ select tipo, corpo, url from aviso_disparo
     where dia = '2031-01-08' and tipo = 'acoes_geral' and user_id = (select user_id from ids where quem = 'J') $$,
  $$ values ('acoes_geral'::text, '2 atrasadas e 2 vencem hoje. Toque para ver a lista.'::text, '/?ir=geral-hoje'::text) $$,
  'J (G1 e G2): um aviso com a soma das duas, na hora mais cedo (G2, global 07:30); a tarefa vinculada conta no lugar da atividade');
select is((select count(*)::int from aviso_disparo where dia = '2031-01-08' and tipo = 'acoes_geral'
  and user_id = (select user_id from ids where quem = 'M')), 0, 'M (só G1, ações às 09:00): nada às 07:40');
select is((select count(*)::int from aviso_disparo where dia = '2031-01-08' and tipo = 'equipe_geral'
  and user_id = (select user_id from ids where quem = 'C')), 0, 'C (coordena G1): nada às 07:40');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'equipe_geral'
  and user_id = (select user_id from ids where quem = 'D')), '1 atrasada e 1 vence hoje · Avo J 1+1.',
  'D (coordena G2, global): a equipe de G2');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'equipe_geral'
  and user_id = (select user_id from ids where quem = 'A')), '2 atrasadas e 3 vencem hoje · Avo J 2+2, Avo M 0+1.',
  'A (administrador): a equipe das duas obras, na hora mais cedo');

select gerar_avisos_gerais('2031-01-08 09:10-03');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'acoes_geral'
  and user_id = (select user_id from ids where quem = 'M')), '1 vence hoje. Toque para ver a lista.',
  'config da obra muda o horário: M recebe às 09:10');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'equipe_geral'
  and user_id = (select user_id from ids where quem = 'C')), '1 atrasada e 2 vencem hoje · Avo J 1+1, Avo M 0+1.',
  'C recebe o da equipe de G1 às 09:10');
select is((select count(*)::int from aviso_disparo where dia = '2031-01-08' and tipo in ('acoes_geral', 'equipe_geral')
  and user_id in (select user_id from ids where quem in ('J', 'A', 'D'))), 3, 'sem duplicar no mesmo dia');
select is((select count(*)::int from aviso_disparo where tipo in ('acoes_geral', 'equipe_geral')
  and user_id = (select user_id from ids where quem = 'K')), 0, 'pessoa só da Contorno não recebe aviso geral');

-- Quinta 09/01: G1 com ações desligadas não conta para ninguém.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006b2","role":"authenticated"}';
select salvar_config_avisos_obra('00000000-0000-0000-0000-00000006b001', '{"acoes_ativo":false}'::jsonb);
reset role;
select gerar_avisos_gerais('2031-01-09 07:40-03');
select is((select corpo from aviso_disparo where dia = '2031-01-09' and tipo = 'acoes_geral'
  and user_id = (select user_id from ids where quem = 'J')), '2 atrasadas. Toque para ver a lista.',
  'obra com ações desligadas fica fora da soma');
select gerar_avisos_gerais('2031-01-09 09:10-03');
select is((select count(*)::int from aviso_disparo where dia = '2031-01-09' and tipo in ('acoes_geral', 'equipe_geral')
  and user_id in (select user_id from ids where quem in ('M', 'C'))), 0, 'só de G1 (desligada): nada');
select is(gerar_avisos_gerais('2031-01-11 08:10-03'), 0, 'sábado: nada');

-- 4) Lembretes de reunião -----------------------------------------------------------
-- Quarta: G1 às 10:00 (antes 30 min), G2 às 16:00 (global, antes 1 hora); manhã 08:00.
-- As chamadas das 09:10 acima já caíram na janela da manhã: recomeça.
delete from aviso_disparo where tipo in ('reuniao_manha_geral', 'reuniao_antes_geral');
select gerar_avisos_gerais('2031-01-07 08:10-03');
select is((select count(*)::int from aviso_disparo where tipo in ('reuniao_manha_geral', 'reuniao_antes_geral')),
  0, 'terça (não é o dia da reunião): nada');
select gerar_avisos_gerais('2031-01-08 08:10-03');
select results_eq(
  $$ select i.quem, a.titulo, a.corpo, a.url from aviso_disparo a join ids i on i.user_id = a.user_id
     where a.dia = '2031-01-08' and a.tipo = 'reuniao_manha_geral' order by i.quem $$,
  $$ values
    ('A'::text, 'CONTRO · Reunião'::text, 'Reuniões hoje: Avo G1 10:00 · Avo G2 16:00'::text,
     '/?ir=geral-reuniao&obra=00000000-0000-0000-0000-00000006b001'::text),
    ('C', 'CONTRO · Reunião', 'Reunião hoje às 10:00 · Avo G1', '/?ir=geral-reuniao&obra=00000000-0000-0000-0000-00000006b001'),
    ('D', 'CONTRO · Reunião', 'Reunião hoje às 16:00 · Avo G2', '/?ir=geral-reuniao&obra=00000000-0000-0000-0000-00000006b002'),
    ('J', 'CONTRO · Reunião', 'Reuniões hoje: Avo G1 10:00 · Avo G2 16:00', '/?ir=geral-reuniao&obra=00000000-0000-0000-0000-00000006b001'),
    ('M', 'CONTRO · Reunião', 'Reunião hoje às 10:00 · Avo G1', '/?ir=geral-reuniao&obra=00000000-0000-0000-0000-00000006b001') $$,
  'de manhã: participantes e Administradores; duas obras numa linha só');
select is((select count(*)::int from aviso_disparo where dia = '2031-01-08' and tipo = 'reuniao_manha_geral'
  and user_id not in (select p.user_id from pessoa p where p.user_id is not null and p.administrador)
  and user_id not in (select user_id from ids)), 0, 'fora do elenco, só Administradores recebem');

select gerar_avisos_gerais('2031-01-08 09:20-03');
select is((select count(*)::int from aviso_disparo where dia = '2031-01-08' and tipo = 'reuniao_antes_geral'),
  0, '09:20: ainda fora dos 30 min de G1');
select gerar_avisos_gerais('2031-01-08 09:35-03');
select results_eq(
  $$ select i.quem, a.corpo, a.url from aviso_disparo a join ids i on i.user_id = a.user_id
     where a.dia = '2031-01-08' and a.tipo = 'reuniao_antes_geral' order by i.quem $$,
  $$ values
    ('A'::text, 'Começa em 30 min · Avo G1'::text, '/?ir=geral-reuniao&obra=00000000-0000-0000-0000-00000006b001'::text),
    ('C', 'Começa em 30 min · Avo G1', '/?ir=geral-reuniao&obra=00000000-0000-0000-0000-00000006b001'),
    ('J', 'Começa em 30 min · Avo G1', '/?ir=geral-reuniao&obra=00000000-0000-0000-0000-00000006b001'),
    ('M', 'Começa em 30 min · Avo G1', '/?ir=geral-reuniao&obra=00000000-0000-0000-0000-00000006b001') $$,
  'antes de começar: a reunião de G1, na janela dela');
select gerar_avisos_gerais('2031-01-08 15:10-03');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'reuniao_antes_geral'
  and user_id = (select user_id from ids where quem = 'D')), 'Começa em 1 hora · Avo G2', 'D: a de G2, 1 hora antes');
select is((select count(*)::int from aviso_disparo where dia = '2031-01-08' and tipo = 'reuniao_antes_geral'
  and user_id = (select user_id from ids where quem = 'J')), 1, 'J: um "antes de começar" por dia (vale a primeira)');
select is(gerar_avisos_gerais('2031-01-08 16:05-03'), 0, 'depois da reunião: nada');
select is((select count(*)::int from aviso_disparo where tipo in ('reuniao_manha_geral', 'reuniao_antes_geral')
  and user_id = (select user_id from ids where quem = 'K')), 0, 'pessoa só da Contorno não recebe lembrete geral');

-- 5) A Contorno não muda ------------------------------------------------------------
-- Tarefa atrasada de K na Contorno; as ações das obras gerais não entram.
insert into tarefa (obra_id, texto, prazo, responsavel_id) values
  ('00000000-0000-0000-0000-00000006b004', 'Tarefa K', '2031-01-07', (select id from ids where quem = 'K'));
select gerar_avisos('2031-01-08 08:10-03');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'acoes_equipe'
  and user_id = (select user_id from ids where quem = 'A')), '1 atrasada · Avo K 1+0.', 'Equipe hoje da Contorno só conta a Contorno');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'reuniao_manha'
  and user_id = (select user_id from ids where quem = 'K')),
  'Reunião hoje às 16h. 1 obra na pauta. Prepare as providências da semana.', 'lembrete da Contorno igual (global)');
select is((select count(*)::int from aviso_disparo where dia = '2031-01-08' and tipo in ('reuniao_manha', 'acoes', 'acoes_equipe')
  and user_id in (select user_id from ids where quem in ('C', 'D', 'J', 'M'))), 0,
  'quem é só de Obras gerais não recebe o da Contorno');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000006b6","role":"authenticated"}';
select set_config('avo.rk', abrir_reuniao('2031-01-15')::text, true);
select is((select hora from reuniao where id = current_setting('avo.rk')::uuid), '16:00'::time,
  'abrir_reuniao da Contorno usa a global');

-- Rotinas protegidas.
select ok(not has_function_privilege('authenticated', 'public.contro_config_avisos_obra(uuid)', 'execute'),
  'authenticated não executa contro_config_avisos_obra');
select ok(not has_function_privilege('authenticated', 'public.gerar_avisos_gerais(timestamptz)', 'execute'),
  'authenticated não executa gerar_avisos_gerais');

select * from finish();
rollback;
