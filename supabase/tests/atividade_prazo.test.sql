-- Atividades como ações (pgTAP): o app grava o fim previsto da atividade
-- (fim_previsto_calc) pela RPC atualizar_prazos_atividades, e o aviso "Equipe
-- hoje" do gestor conta as atividades de topo abertas, de fase de obra (não
-- preliminar), sem tarefa vinculada aberta nos totais ("Sem responsável", sem
-- ocupar vaga de nome).
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(19);

-- Cenário: gestor G, equipe J e um usuário X sem cadastro de pessoa.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'gestor@atvprazo.contro'),
  ('00000000-0000-0000-0000-0000000000e2', 'equipe@atvprazo.contro'),
  ('00000000-0000-0000-0000-0000000000e3', 'estranho@atvprazo.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000e1', 'Gabriel Gestor', 'gestor'),
  ('00000000-0000-0000-0000-0000000000e2', 'Joana da Silva', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2031-01-06', 'Obra Prazo Atv', (select id from modelo where nome = 'Modelo 1 · CDC completo'));
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2031-01-06', 'Obra Outra Atv', (select id from modelo where nome = 'Modelo 1 · CDC completo'));
reset role;
-- Só esta obra conta (isola de qualquer dado de outro teste).
update obra set status = 'pausada' where nome <> 'Obra Prazo Atv';

-- A1, A2 e A3: atividades de topo da primeira fase de obra (não preliminar);
-- PRE: atividade de topo de fase preliminar; OUTRA: atividade de outra obra.
create temp table ids (k text primary key, id uuid);
insert into ids
select 'obra', id from obra where nome = 'Obra Prazo Atv';
insert into ids
select 'a' || row_number() over (order by oa.ordem, oa.id), oa.id
from obra_atividade oa
where oa.fase_id = (
    select f.id from obra_fase f
    where f.obra_id = (select id from ids where k = 'obra') and not f.preliminar
    order by f.ordem limit 1)
  and oa.pai_id is null and oa.deleted_at is null
order by oa.ordem, oa.id
limit 3;
insert into ids
select 'pre', oa.id from obra_atividade oa
join obra_fase f on f.id = oa.fase_id and f.preliminar
where oa.obra_id = (select id from ids where k = 'obra') and oa.pai_id is null
order by f.ordem, oa.ordem limit 1;
insert into ids
select 'outra', oa.id from obra_atividade oa
where oa.obra_id = (select id from obra where nome = 'Obra Outra Atv') and oa.pai_id is null limit 1;
grant select on ids to authenticated;

-- (a) RPC: grava, é idempotente e só aceita membro.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select is(atualizar_prazos_atividades((select id from ids where k = 'obra'),
    jsonb_build_array(jsonb_build_object('id', (select id from ids where k = 'a1'), 'ate', '2031-01-05'))),
  1, 'RPC grava o fim previsto e devolve 1');
select is(atualizar_prazos_atividades((select id from ids where k = 'obra'),
    jsonb_build_array(jsonb_build_object('id', (select id from ids where k = 'a1'), 'ate', '2031-01-05'))),
  0, 'segunda chamada igual devolve 0');
select is(atualizar_prazos_atividades((select id from ids where k = 'obra'),
    jsonb_build_array(jsonb_build_object('id', (select id from ids where k = 'outra'), 'ate', '2031-01-05'))),
  0, 'atividade de outra obra não é alterada');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select throws_ok(
  $$select atualizar_prazos_atividades((select id from ids where k = 'obra'),
      jsonb_build_array(jsonb_build_object('id', (select id from ids where k = 'a1'), 'ate', '2031-01-10')))$$,
  '42501', null, 'usuário não membro recebe erro');
reset role;
select is((select fim_previsto_calc from obra_atividade where id = (select id from ids where k = 'a1')),
  '2031-01-05'::date, 'fim previsto gravado em A1');
select ok((select fim_previsto_calc is null and (select count(*) from ids where id is not null) = 6
           from obra_atividade where id = (select id from ids where k = 'outra')),
  'outra obra continua sem fim previsto');
select ok(
  not has_function_privilege('anon', 'atualizar_prazos_atividades(uuid, jsonb)', 'execute')
  and has_function_privilege('authenticated', 'atualizar_prazos_atividades(uuid, jsonb)', 'execute'),
  'RPC só para authenticated');

create temp view av as
  select a.tipo, a.dia, a.user_id, a.corpo from aviso_disparo a
  where a.tipo in ('acoes', 'acoes_equipe');

-- (b) Hoje = quarta 08/01/2031. A1 terminava dom 05/01 (hoje - 3) e não tem tarefa.
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from av where tipo = 'acoes_equipe' and user_id = '00000000-0000-0000-0000-0000000000e1'),
  '1 atrasada.', 'atividade sem dono atrasada conta nos totais do gestor');
select ok((select corpo not like '%Sem responsável%' from av where tipo = 'acoes_equipe'),
  'sem responsável não aparece pelo nome');
select is((select count(*)::int from av where user_id = '00000000-0000-0000-0000-0000000000e2'),
  0, 'J não recebe nada pela atividade sem dono');

-- (c) Tarefa aberta vinculada a A1, de J, vencida ontem: A1 sai de "sem" e a
-- tarefa a representa.
insert into tarefa (obra_id, texto, responsavel_id, prazo, vinculo_tipo, vinculo_id) values
  ((select id from ids where k = 'obra'), 'Fechar o orçamento',
   (select id from pessoa where user_id = '00000000-0000-0000-0000-0000000000e2'), '2031-01-07',
   'atividade', (select id from ids where k = 'a1'));
delete from aviso_disparo where tipo in ('acoes', 'acoes_equipe');
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from av where tipo = 'acoes_equipe'),
  '1 atrasada · Joana S 1+0.', 'com tarefa vinculada aberta conta só a tarefa, em J');
select is((select corpo from av where tipo = 'acoes' and user_id = '00000000-0000-0000-0000-0000000000e2'),
  '1 atrasada. Toque para ver a lista.', 'J recebe a ação da tarefa vinculada');

-- (d) Tarefa feita: A1 volta a ser sem dono. A2 aberta sem fim previsto
-- gravado (null) não conta.
update tarefa set status = 'feita', feita_em = now() where vinculo_id = (select id from ids where k = 'a1');
select ok((select fim_previsto_calc is null and concluida_em is null from obra_atividade
           where id = (select id from ids where k = 'a2')), 'A2 aberta e sem fim previsto');
delete from aviso_disparo where tipo in ('acoes', 'acoes_equipe');
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from av where tipo = 'acoes_equipe'),
  '1 atrasada.', 'atividade com fim_previsto_calc null não conta');

-- (e) A2 vira subitem de A1 (mesma fase) e vence hoje: subitem não conta.
update obra_atividade set pai_id = (select id from ids where k = 'a1'), fim_previsto_calc = '2031-01-08'
  where id = (select id from ids where k = 'a2');
delete from aviso_disparo where tipo in ('acoes', 'acoes_equipe');
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from av where tipo = 'acoes_equipe'),
  '1 atrasada.', 'subitem não conta');

-- (f) Atividade de fase preliminar (pré-obra) com data de hoje CONTA (04/11/2026:
-- o pré-obra também vira ação); atividade de obra pausada atrasada não conta.
update obra_atividade set fim_previsto_calc = '2031-01-08' where id = (select id from ids where k = 'pre');
update obra_atividade set fim_previsto_calc = '2031-01-05' where id = (select id from ids where k = 'outra');
delete from aviso_disparo where tipo in ('acoes', 'acoes_equipe');
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from av where tipo = 'acoes_equipe'),
  '1 atrasada e 1 vence hoje.', 'pré-obra conta; obra pausada não conta');

-- Controle: A3 de topo, fase de obra, vence hoje: conta como "vence hoje".
update obra_atividade set fim_previsto_calc = '2031-01-08' where id = (select id from ids where k = 'a3');
delete from aviso_disparo where tipo in ('acoes', 'acoes_equipe');
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from av where tipo = 'acoes_equipe'),
  '1 atrasada e 2 vencem hoje.', 'atividade sem dono que vence hoje entra no total');

-- (g) Obra pausada: nada conta, o gestor não recebe aviso.
update obra set status = 'pausada' where id = (select id from ids where k = 'obra');
delete from aviso_disparo where tipo in ('acoes', 'acoes_equipe');
select gerar_avisos('2031-01-08 07:40-03');
select is((select count(*)::int from av), 0, 'obra pausada não conta');

-- Atividade concluída também não conta (obra reativada, A3 concluída).
update obra set status = 'ativa' where id = (select id from ids where k = 'obra');
update obra_atividade set concluida_em = '2031-01-07 10:00-03' where id = (select id from ids where k = 'a3');
delete from aviso_disparo where tipo in ('acoes', 'acoes_equipe');
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from av where tipo = 'acoes_equipe'),
  '1 atrasada e 1 vence hoje.', 'atividade concluída não conta (fica a do pré-obra)');

select * from finish();
rollback;
