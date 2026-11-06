-- Excluir e restaurar subitem pela mesma RPC da atividade (pgTAP): na Contorno
-- a ficha chama excluir_atividade_obra também para o subitem; a atividade de
-- topo continua levando os subitens; Membro de obra geral não exclui.
begin;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000003d1', 'm@sub.contro'),
  ('00000000-0000-0000-0000-0000000003d4', 'j@sub.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000003d1', 'Sub M', 'equipe'),
  ('00000000-0000-0000-0000-0000000003d4', 'Sub J', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set acesso_contorno = false, papel_geral = 'membro' where user_id = '00000000-0000-0000-0000-0000000003d4';

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000003f001', 'Sub K', '2026-11-02', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000003f002', 'Sub G', '2026-11-02', 'x', 'geral');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000003f002', id from pessoa where user_id = '00000000-0000-0000-0000-0000000003d4';
insert into obra_fase (id, obra_id, ordem, titulo) values
  ('00000000-0000-0000-0000-00000003f101', '00000000-0000-0000-0000-00000003f001', 1, 'Fase K'),
  ('00000000-0000-0000-0000-00000003f102', '00000000-0000-0000-0000-00000003f002', 1, 'Fase G');
insert into obra_atividade (id, obra_id, fase_id, ordem, nome) values
  ('00000000-0000-0000-0000-00000003f201', '00000000-0000-0000-0000-00000003f001', '00000000-0000-0000-0000-00000003f101', 1, 'Atividade K'),
  ('00000000-0000-0000-0000-00000003f202', '00000000-0000-0000-0000-00000003f002', '00000000-0000-0000-0000-00000003f102', 1, 'Atividade G');
insert into obra_atividade (id, obra_id, fase_id, pai_id, ordem, nome) values
  ('00000000-0000-0000-0000-00000003f211', '00000000-0000-0000-0000-00000003f001', '00000000-0000-0000-0000-00000003f101', '00000000-0000-0000-0000-00000003f201', 1, 'Sub 1'),
  ('00000000-0000-0000-0000-00000003f212', '00000000-0000-0000-0000-00000003f001', '00000000-0000-0000-0000-00000003f101', '00000000-0000-0000-0000-00000003f201', 2, 'Sub 2'),
  ('00000000-0000-0000-0000-00000003f221', '00000000-0000-0000-0000-00000003f002', '00000000-0000-0000-0000-00000003f102', '00000000-0000-0000-0000-00000003f202', 1, 'Sub G1');

set local role authenticated;

-- Membro da Contorno exclui só o subitem.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003d1","role":"authenticated"}';
select lives_ok($$select excluir_atividade_obra('00000000-0000-0000-0000-00000003f211')$$, 'exclui o subitem');
select isnt((select deleted_at from obra_atividade where id = '00000000-0000-0000-0000-00000003f211'), null, 'subitem some');
select is((select deleted_at from obra_atividade where id = '00000000-0000-0000-0000-00000003f201'), null, 'o pai fica');
select is((select deleted_at from obra_atividade where id = '00000000-0000-0000-0000-00000003f212'), null, 'o irmão fica');
select is(
  (select depois from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000003f211' and tipo = 'excluida'),
  '{"subitens": []}'::jsonb, 'evento excluida com subitens vazios');
select throws_ok($$select excluir_atividade_obra('00000000-0000-0000-0000-00000003f211')$$, '23503', null, 'já excluído: 23503');

-- Restaurar devolve o subitem.
select lives_ok($$select restaurar_atividade_obra('00000000-0000-0000-0000-00000003f211')$$, 'restaura o subitem');
select is((select deleted_at from obra_atividade where id = '00000000-0000-0000-0000-00000003f211'), null, 'subitem volta');

-- Subitem cujo pai foi excluído não se restaura sozinho.
select excluir_atividade_obra('00000000-0000-0000-0000-00000003f211');
select excluir_atividade_obra('00000000-0000-0000-0000-00000003f201');
select throws_ok($$select restaurar_atividade_obra('00000000-0000-0000-0000-00000003f211')$$, '23503', null, 'pai excluído: 23503');

-- Atividade de topo continua levando e trazendo os subitens.
select is((select count(*)::int from obra_atividade where pai_id = '00000000-0000-0000-0000-00000003f201' and deleted_at is null), 0, 'excluir o topo levou o subitem que restava');
select restaurar_atividade_obra('00000000-0000-0000-0000-00000003f201');
select is((select count(*)::int from obra_atividade where (id = '00000000-0000-0000-0000-00000003f201' or pai_id = '00000000-0000-0000-0000-00000003f201') and deleted_at is null), 2, 'restaurar o topo traz o pai e o subitem do evento');

-- Membro de obra geral não exclui subitem.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003d4","role":"authenticated"}';
select throws_ok($$select excluir_atividade_obra('00000000-0000-0000-0000-00000003f221')$$, '42501', null, 'Membro geral não exclui subitem');
reset role;

select * from finish();
rollback;
