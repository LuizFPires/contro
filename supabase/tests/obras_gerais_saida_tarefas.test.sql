-- Obras gerais · Etapa 4: quem sai de uma obra geral deixa as tarefas e as
-- pendências abertas dela (com evento), e o acoes_geral só conta as obras que
-- a pessoa vê (participa ou é Administrador).
begin;
select plan(12);

-- Elenco: A administrador, C coordenador de G1, J membro de G1 e G2.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007c1', 'a@sai.contro'),
  ('00000000-0000-0000-0000-0000000007c2', 'c@sai.contro'),
  ('00000000-0000-0000-0000-0000000007c3', 'j@sai.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000007c1', 'Sai A', 'gestor'),
  ('00000000-0000-0000-0000-0000000007c2', 'Sai C', 'equipe'),
  ('00000000-0000-0000-0000-0000000007c3', 'Sai J', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000007c1';
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where user_id = '00000000-0000-0000-0000-0000000007c2';
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id = '00000000-0000-0000-0000-0000000007c3';

create temp table ids as
  select split_part(nome, ' ', 2) as quem, id, user_id from pessoa
  where user_id::text like '00000000-0000-0000-0000-0000000007c_';
grant select on ids to authenticated;

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000007c001', 'Sai G1', '2031-01-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000007c002', 'Sai G2', '2031-01-01', 'x', 'geral');
-- Só estas obras contam (isola dos dados do seed e de outros testes).
update obra set status = 'pausada' where id not in (
  '00000000-0000-0000-0000-00000007c001', '00000000-0000-0000-0000-00000007c002');

insert into obra_participante (obra_id, pessoa_id)
  select o.id::uuid, i.id from ids i
  join (values
    ('00000000-0000-0000-0000-00000007c001', 'C'),
    ('00000000-0000-0000-0000-00000007c001', 'J'), ('00000000-0000-0000-0000-00000007c002', 'J')
  ) as o (id, quem) on o.quem = i.quem;

-- Global conhecida: ações às 07:30, pendência alta em 2 d.u.
update config_avisos set acoes_ativo = true, acoes_hora = '07:30',
  pend_alta_du = 2, pend_media_du = 4, pend_baixa_du = 6, manha_ativo = false, antes_ativo = false
  where id;

-- J em G1: tarefa aberta atrasada, tarefa feita, tarefa excluída, pendência
-- aberta (alta, de segunda 06/01 → 08/01, hoje) e pendência fechada.
-- J em G2: tarefa aberta atrasada.
insert into tarefa (id, obra_id, texto, prazo, responsavel_id, status, deleted_at) values
  ('00000000-0000-0000-0000-00000007c201', '00000000-0000-0000-0000-00000007c001', 'Aberta G1', '2031-01-07',
   (select id from ids where quem = 'J'), 'aberta', null),
  ('00000000-0000-0000-0000-00000007c202', '00000000-0000-0000-0000-00000007c001', 'Feita G1', '2031-01-07',
   (select id from ids where quem = 'J'), 'feita', null),
  ('00000000-0000-0000-0000-00000007c203', '00000000-0000-0000-0000-00000007c001', 'Excluída G1', '2031-01-07',
   (select id from ids where quem = 'J'), 'aberta', now()),
  ('00000000-0000-0000-0000-00000007c204', '00000000-0000-0000-0000-00000007c002', 'Aberta G2', '2031-01-07',
   (select id from ids where quem = 'J'), 'aberta', null);
insert into pendencia (id, obra_id, titulo, criticidade, apontada_em, responsavel_id, status) values
  ('00000000-0000-0000-0000-00000007c301', '00000000-0000-0000-0000-00000007c001', 'Trinca', 'alta',
   '2031-01-06 12:00-03', (select id from ids where quem = 'J'), 'aberta'),
  ('00000000-0000-0000-0000-00000007c302', '00000000-0000-0000-0000-00000007c001', 'Fechada', 'alta',
   '2031-01-06 12:00-03', (select id from ids where quem = 'J'), 'fechada');

-- Antes de sair: J tem 2 atrasadas (G1 e G2) e 1 de hoje (pendência de G1).
select gerar_avisos_gerais('2031-01-08 07:40-03');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'acoes_geral'
  and user_id = (select user_id from ids where quem = 'J')), '2 atrasadas e 1 vence hoje. Toque para ver a lista.',
  'antes de sair: G1 e G2 contam para J');
delete from aviso_disparo where dia = '2031-01-08' and tipo in ('acoes_geral', 'equipe_geral');

-- A remove J de G1.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007c1","role":"authenticated"}';
select remover_da_obra('00000000-0000-0000-0000-00000007c001', (select id from ids where quem = 'J'));
reset role;

select is((select responsavel_id from tarefa where id = '00000000-0000-0000-0000-00000007c201'), null,
  'tarefa aberta de G1 fica sem responsável');
select results_eq(
  $$ select tipo, por, antes, depois from tarefa_evento
     where tarefa_id = '00000000-0000-0000-0000-00000007c201' $$,
  $$ values ('editada'::text, (select id from ids where quem = 'A'),
       jsonb_build_object('responsavel_id', (select id from ids where quem = 'J')),
       jsonb_build_object('responsavel_id', null, 'motivo', 'saiu da obra')) $$,
  'tarefa: evento editada com antes/depois do responsável');
select is((select count(*)::int from tarefa
  where id in ('00000000-0000-0000-0000-00000007c202', '00000000-0000-0000-0000-00000007c203')
    and responsavel_id = (select id from ids where quem = 'J')), 2,
  'tarefa feita e tarefa excluída ficam como estão');
select is((select count(*)::int from tarefa_evento
  where tarefa_id in ('00000000-0000-0000-0000-00000007c202', '00000000-0000-0000-0000-00000007c203')), 0,
  'sem evento nas que não mudaram');
select is((select responsavel_id from tarefa where id = '00000000-0000-0000-0000-00000007c204'),
  (select id from ids where quem = 'J'), 'tarefa de G2 (obra de que J segue participando) não muda');

select is((select responsavel_id from pendencia where id = '00000000-0000-0000-0000-00000007c301'), null,
  'pendência aberta de G1 fica sem responsável');
select results_eq(
  $$ select tipo, por, dados from pendencia_evento
     where pendencia_id = '00000000-0000-0000-0000-00000007c301' and tipo = 'responsavel_alterado' $$,
  $$ values ('responsavel_alterado'::text, (select id from ids where quem = 'A'),
       jsonb_build_object('antes', (select id from ids where quem = 'J'), 'depois', null, 'motivo', 'saiu da obra')) $$,
  'pendência: evento responsavel_alterado (o de atribuir_pendencia)');
select is((select responsavel_id from pendencia where id = '00000000-0000-0000-0000-00000007c302'),
  (select id from ids where quem = 'J'), 'pendência fechada fica como está');

-- Depois de sair: só G2 conta para J.
select gerar_avisos_gerais('2031-01-08 07:40-03');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'acoes_geral'
  and user_id = (select user_id from ids where quem = 'J')), '1 atrasada. Toque para ver a lista.',
  'depois de sair: o acoes_geral de J não conta mais G1');

-- Defesa: mesmo que algo volte a pôr J numa ação de G1, ela não conta para J.
update tarefa set responsavel_id = (select id from ids where quem = 'J')
  where id = '00000000-0000-0000-0000-00000007c201';
delete from aviso_disparo where dia = '2031-01-08' and tipo in ('acoes_geral', 'equipe_geral');
select gerar_avisos_gerais('2031-01-08 07:40-03');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'acoes_geral'
  and user_id = (select user_id from ids where quem = 'J')), '1 atrasada. Toque para ver a lista.',
  'acoes_geral só conta as obras de que a pessoa participa');
-- O Administrador vê todas: a ação dele numa obra de que não participa conta.
update tarefa set responsavel_id = (select id from ids where quem = 'A')
  where id = '00000000-0000-0000-0000-00000007c204';
delete from aviso_disparo where dia = '2031-01-08' and tipo in ('acoes_geral', 'equipe_geral');
select gerar_avisos_gerais('2031-01-08 07:40-03');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'acoes_geral'
  and user_id = (select user_id from ids where quem = 'A')), '1 atrasada. Toque para ver a lista.',
  'Administrador: conta a ação dele em obra de que não participa');

select * from finish();
rollback;
