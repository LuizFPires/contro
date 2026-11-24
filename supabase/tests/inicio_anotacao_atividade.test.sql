-- Ficha da atividade (24/11/2026): início previsto na obra geral (só quem
-- planeja, com motivo no ajuste e Desfazer), término não antes do início e
-- anotação do andamento por quem vê a obra (Contorno e geral, idempotente).
begin;
select plan(36);

-- Elenco: M equipe Contorno, C coordenador de G, J membro de G.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000003e1', 'm@ini.contro'),
  ('00000000-0000-0000-0000-0000000003e2', 'c@ini.contro'),
  ('00000000-0000-0000-0000-0000000003e3', 'j@ini.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000003e1', 'Ini M', 'equipe'),
  ('00000000-0000-0000-0000-0000000003e2', 'Ini C', 'equipe'),
  ('00000000-0000-0000-0000-0000000003e3', 'Ini J', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where user_id = '00000000-0000-0000-0000-0000000003e2';
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id = '00000000-0000-0000-0000-0000000003e3';

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000003f001', 'Ini K', '2026-11-02', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000003f002', 'Ini G', '2026-11-02', 'x', 'geral');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000003f002', id from pessoa
  where user_id in ('00000000-0000-0000-0000-0000000003e2', '00000000-0000-0000-0000-0000000003e3');
insert into obra_fase (id, obra_id, ordem, titulo) values
  ('00000000-0000-0000-0000-00000003f101', '00000000-0000-0000-0000-00000003f001', 1, 'Fase K'),
  ('00000000-0000-0000-0000-00000003f102', '00000000-0000-0000-0000-00000003f002', 1, 'Fase G');
-- Como superusuário (fora da RLS e do gatilho): datas de partida.
insert into obra_atividade (id, obra_id, fase_id, ordem, nome, data_prevista) values
  ('00000000-0000-0000-0000-00000003f201', '00000000-0000-0000-0000-00000003f001', '00000000-0000-0000-0000-00000003f101', 1, 'Atividade K', null),
  ('00000000-0000-0000-0000-00000003f202', '00000000-0000-0000-0000-00000003f002', '00000000-0000-0000-0000-00000003f102', 1, 'Arrasamento', '2026-11-20'),
  ('00000000-0000-0000-0000-00000003f203', '00000000-0000-0000-0000-00000003f002', '00000000-0000-0000-0000-00000003f102', 2, 'Com subitem', '2026-11-10');
insert into obra_atividade (id, obra_id, fase_id, pai_id, ordem, nome, data_prevista) values
  ('00000000-0000-0000-0000-00000003f204', '00000000-0000-0000-0000-00000003f002', '00000000-0000-0000-0000-00000003f102',
   '00000000-0000-0000-0000-00000003f203', 1, 'Subitem', '2026-11-27');

set local role authenticated;

-- C (coordenador de G): planeja o início
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003e2","role":"authenticated"}';

create temp table ev (nome text primary key, id uuid);
grant all on ev to authenticated;

insert into ev values ('def', definir_inicio_previsto('00000000-0000-0000-0000-00000003f202', '2026-11-09'));
select isnt((select id from ev where nome = 'def'), null, 'primeiro inicio devolve o evento');
select is((select data_inicio from obra_atividade where id = '00000000-0000-0000-0000-00000003f202'),
  '2026-11-09'::date, 'inicio gravado');
select is((select tipo from obra_atividade_evento where id = (select id from ev where nome = 'def')),
  'inicio_definido', 'primeiro inicio grava inicio_definido');
select is(definir_inicio_previsto('00000000-0000-0000-0000-00000003f202', '2026-11-09'), null,
  'mesma data: nada muda');

insert into ev values ('aj', definir_inicio_previsto('00000000-0000-0000-0000-00000003f202', '2026-11-11', '  choveu  '));
select is(
  (select row(tipo, antes ->> 'inicio', depois ->> 'inicio', depois ->> 'motivo')::text
   from obra_atividade_evento where id = (select id from ev where nome = 'aj')),
  row('inicio_ajustado', '2026-11-09', '2026-11-11', 'choveu')::text,
  'mudar o inicio grava inicio_ajustado com o motivo aparado');
select is(
  (select replanejamentos from obra_atividade where id = '00000000-0000-0000-0000-00000003f202'), 0,
  'ajuste do inicio nao mexe no contador do termino');

select throws_ok($$ select definir_inicio_previsto('00000000-0000-0000-0000-00000003f202', '2026-11-23') $$,
  '22023', 'O início fica depois do término', 'inicio depois do termino e recusado');
select throws_ok($$ select definir_inicio_previsto('00000000-0000-0000-0000-00000003f202', null) $$,
  '22023', null, 'item aberto com inicio nao volta a sem inicio');
select throws_ok($$ select definir_data_prevista('00000000-0000-0000-0000-00000003f202', '2026-11-10') $$,
  '22023', 'O término fica antes do início', 'termino antes do inicio e recusado');
select isnt(definir_data_prevista('00000000-0000-0000-0000-00000003f202', '2026-11-25', 'choveu demais'), null,
  'termino depois do inicio passa');
select is(
  (select depois ->> 'motivo' from obra_atividade_evento
   where atividade_id = '00000000-0000-0000-0000-00000003f202' and tipo = 'replanejada'),
  'choveu demais', 'replanejamento do termino guarda o motivo');

-- Com subitem: o termino e a maior data dos subitens (27/11), nao a da atividade.
select isnt(definir_inicio_previsto('00000000-0000-0000-0000-00000003f203', '2026-11-20'), null,
  'com subitem, inicio ate a data do ultimo subitem');
select throws_ok($$ select definir_inicio_previsto('00000000-0000-0000-0000-00000003f203', '2026-11-30') $$,
  '22023', null, 'com subitem, inicio depois do ultimo subitem e recusado');
select throws_ok($$ select editar_subitem_geral('00000000-0000-0000-0000-00000003f204', 'Subitem', '2026-11-19') $$,
  '22023', 'O subitem termina antes do início da atividade', 'subitem nao termina antes do inicio da atividade');
select throws_ok($$ select adicionar_subitem_geral('00000000-0000-0000-0000-00000003f203', 'Novo', '2026-11-18') $$,
  '22023', 'O subitem termina antes do início da atividade', 'subitem novo nao termina antes do inicio');
select lives_ok($$ select adicionar_subitem_geral('00000000-0000-0000-0000-00000003f203', 'Novo', '2026-11-24') $$,
  'subitem novo depois do inicio passa');
select throws_ok($$ select definir_inicio_previsto('00000000-0000-0000-0000-00000003f204', '2026-11-20') $$,
  '23503', null, 'subitem nao tem inicio');
select throws_ok($$ select definir_inicio_previsto('00000000-0000-0000-0000-00000003f201', '2026-11-20') $$,
  '23505', null, 'obra da Contorno usa as funcoes da Contorno');

-- Escrita direta do inicio: o gatilho recusa.
select throws_ok($$ update obra_atividade set data_inicio = '2026-11-12'
  where id = '00000000-0000-0000-0000-00000003f202' $$,
  '42501', null, 'inicio so muda por funcao');

-- Desfazer do ajuste: volta para 09/11 e grava inicio_desfeito.
select lives_ok(format('select desfazer_inicio_previsto(%L)', (select id from ev where nome = 'aj')),
  'C desfaz o ajuste do inicio');
select is((select data_inicio from obra_atividade where id = '00000000-0000-0000-0000-00000003f202'),
  '2026-11-09'::date, 'inicio voltou');
select is(
  (select depois ->> 'evento_id' from obra_atividade_evento
   where atividade_id = '00000000-0000-0000-0000-00000003f202' and tipo = 'inicio_desfeito'),
  (select id::text from ev where nome = 'aj'), 'inicio_desfeito aponta o evento desfeito');
select throws_ok(format('select desfazer_inicio_previsto(%L)', (select id from ev where nome = 'aj')),
  '22023', null, 'nao desfaz duas vezes');
select throws_ok(format('select desfazer_inicio_previsto(%L)', (select id from ev where nome = 'def')),
  '22023', null, 'so desfaz o ultimo evento de inicio');

-- Desfazer que deixaria o termino antes do inicio: o gatilho recusa.
insert into ev values ('t', definir_data_prevista('00000000-0000-0000-0000-00000003f202', '2026-11-27'));
select definir_inicio_previsto('00000000-0000-0000-0000-00000003f202', '2026-11-26');
select throws_ok(format('select desfazer_data_prevista(%L)', (select id from ev where nome = 't')),
  '22023', 'O término fica antes do início', 'desfazer o termino nao deixa ele antes do inicio');

-- J (membro de G): nao planeja, mas anota o andamento.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003e3","role":"authenticated"}';
select throws_ok($$ select definir_inicio_previsto('00000000-0000-0000-0000-00000003f202', '2026-11-10') $$,
  '42501', null, 'membro nao muda o inicio');

reset role;
update obra_atividade set avanco_pct = 25 where id = '00000000-0000-0000-0000-00000003f202';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003e3","role":"authenticated"}';

select lives_ok($$ select anotar_atividade('00000000-0000-0000-0000-00000003f202',
  '  Choveu demais, nao deu para trabalhar ', '00000000-0000-0000-0000-0000000003a1') $$,
  'membro anota o andamento');
select lives_ok($$ select anotar_atividade('00000000-0000-0000-0000-00000003f202',
  'Choveu demais, nao deu para trabalhar', '00000000-0000-0000-0000-0000000003a1') $$,
  'mesma op de novo nao falha');
select is(
  (select count(*)::int from obra_atividade_evento
   where atividade_id = '00000000-0000-0000-0000-00000003f202' and tipo = 'anotacao'),
  1, 'mesma op nao duplica a anotacao');
select is(
  (select row(depois ->> 'texto', depois ->> 'pct', por = (select id from pessoa where user_id = auth.uid()))::text
   from obra_atividade_evento
   where atividade_id = '00000000-0000-0000-0000-00000003f202' and tipo = 'anotacao'),
  row('Choveu demais, nao deu para trabalhar', '25', true)::text,
  'anotacao guarda texto aparado, avanco da hora e quem anotou');
select throws_ok($$ select anotar_atividade('00000000-0000-0000-0000-00000003f202', '   ') $$,
  '22023', null, 'anotacao vazia e recusada');
select throws_ok(format('select anotar_atividade(%L, %L)', '00000000-0000-0000-0000-00000003f202', repeat('x', 501)),
  '22023', null, 'anotacao com mais de 500 caracteres e recusada');
select throws_ok($$ select anotar_atividade('00000000-0000-0000-0000-00000003f204', 'sub') $$,
  '23503', null, 'subitem nao recebe anotacao');
select throws_ok($$ select anotar_atividade('00000000-0000-0000-0000-00000003f201', 'outra obra') $$,
  '42501', null, 'membro de G nao anota na obra da Contorno');

-- M (equipe da Contorno): anota na Contorno, nao na obra geral.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003e1","role":"authenticated"}';
select lives_ok($$ select anotar_atividade('00000000-0000-0000-0000-00000003f201', 'Material chegou') $$,
  'equipe da Contorno anota na Contorno');
select throws_ok($$ select anotar_atividade('00000000-0000-0000-0000-00000003f202', 'nao participa') $$,
  '42501', null, 'equipe da Contorno nao anota na obra geral sem participar');

select * from finish();
rollback;
