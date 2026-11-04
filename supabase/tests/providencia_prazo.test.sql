-- Providências como ações (pgTAP): o app grava o prazo calculado da providência
-- (providenciar_ate) pela RPC atualizar_prazos_providencias, e o aviso "Equipe
-- hoje" do gestor conta as providências pendentes sem tarefa vinculada aberta
-- nos totais ("Sem responsável", sem ocupar vaga de nome).
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(17);

-- Cenário: gestor G, equipe J e um usuário X sem cadastro de pessoa.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'gestor@provprazo.contro'),
  ('00000000-0000-0000-0000-0000000000d2', 'equipe@provprazo.contro'),
  ('00000000-0000-0000-0000-0000000000d3', 'estranho@provprazo.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000d1', 'Gabriel Gestor', 'gestor'),
  ('00000000-0000-0000-0000-0000000000d2', 'Joana da Silva', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2031-01-06', 'Obra Prazo Prov', (select id from modelo where nome = 'Modelo 1 · CDC completo'));
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2031-01-06', 'Obra Outra Prov', (select id from modelo where nome = 'Modelo 1 · CDC completo'));
reset role;
-- Só esta obra conta (isola de qualquer dado de outro teste).
update obra set status = 'pausada' where nome <> 'Obra Prazo Prov';

-- P1, P2 e P3 em atividades distintas da obra; OUTRA é de outra obra.
create temp table ids (k text primary key, id uuid);
insert into ids
select 'obra', id from obra where nome = 'Obra Prazo Prov';
insert into ids
select 'p' || row_number() over (order by atividade_id), id from (
  select distinct on (op.atividade_id) op.id, op.atividade_id
  from obra_providencia op
  where op.obra_id = (select id from ids where k = 'obra') and op.deleted_at is null
  order by op.atividade_id, op.id
) s
order by atividade_id
limit 3;
insert into ids
select 'outra', op.id from obra_providencia op
where op.obra_id = (select id from obra where nome = 'Obra Outra Prov') limit 1;
grant select on ids to authenticated;

-- (a) RPC: grava, é idempotente e só aceita membro.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is(atualizar_prazos_providencias((select id from ids where k = 'obra'),
    jsonb_build_array(jsonb_build_object('id', (select id from ids where k = 'p1'), 'ate', '2031-01-03'))),
  1, 'RPC grava o prazo e devolve 1');
select is(atualizar_prazos_providencias((select id from ids where k = 'obra'),
    jsonb_build_array(jsonb_build_object('id', (select id from ids where k = 'p1'), 'ate', '2031-01-03'))),
  0, 'segunda chamada igual devolve 0');
select is(atualizar_prazos_providencias((select id from ids where k = 'obra'),
    jsonb_build_array(jsonb_build_object('id', (select id from ids where k = 'outra'), 'ate', '2031-01-03'))),
  0, 'providência de outra obra não é alterada');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}';
select throws_ok(
  $$select atualizar_prazos_providencias((select id from ids where k = 'obra'),
      jsonb_build_array(jsonb_build_object('id', (select id from ids where k = 'p1'), 'ate', '2031-01-10')))$$,
  '42501', null, 'usuário não membro recebe erro');
reset role;
select is((select providenciar_ate from obra_providencia where id = (select id from ids where k = 'p1')),
  '2031-01-03'::date, 'prazo gravado em P1');
select ok((select providenciar_ate is null and (select count(*) from ids where id is not null) = 5
           from obra_providencia where id = (select id from ids where k = 'outra')),
  'outra obra continua sem prazo');
select ok(
  not has_function_privilege('anon', 'atualizar_prazos_providencias(uuid, jsonb)', 'execute')
  and has_function_privilege('authenticated', 'atualizar_prazos_providencias(uuid, jsonb)', 'execute'),
  'RPC só para authenticated');

create temp view av as
  select a.tipo, a.dia, a.user_id, a.corpo from aviso_disparo a
  where a.tipo in ('acoes', 'acoes_equipe');

-- (b) Hoje = quarta 08/01/2031. P1 venceu sex 03/01 (hoje - 5) e não tem tarefa.
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from av where tipo = 'acoes_equipe' and user_id = '00000000-0000-0000-0000-0000000000d1'),
  '1 atrasada.', 'providência sem dono atrasada conta nos totais do gestor');
select ok((select corpo not like '%Sem responsável%' from av where tipo = 'acoes_equipe'),
  'sem responsável não aparece pelo nome');
select is((select count(*)::int from av where user_id = '00000000-0000-0000-0000-0000000000d2'),
  0, 'J não recebe nada pela providência sem dono');

-- (c) Tarefa aberta vinculada a P1, de J, vencida ontem: P1 sai de "sem" e a
-- tarefa a representa.
insert into tarefa (obra_id, texto, responsavel_id, prazo, vinculo_tipo, vinculo_id) values
  ((select id from ids where k = 'obra'), 'Contratar pintor',
   (select id from pessoa where user_id = '00000000-0000-0000-0000-0000000000d2'), '2031-01-07',
   'providencia', (select id from ids where k = 'p1'));
delete from aviso_disparo where tipo in ('acoes', 'acoes_equipe');
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from av where tipo = 'acoes_equipe'),
  '1 atrasada · Joana S 1+0.', 'com tarefa vinculada aberta conta só a tarefa, em J');
select is((select corpo from av where tipo = 'acoes' and user_id = '00000000-0000-0000-0000-0000000000d2'),
  '1 atrasada. Toque para ver a lista.', 'J recebe a ação da tarefa vinculada');

-- (d) Tarefa feita: P1 volta a ser sem dono. P2 pendente sem prazo gravado
-- (null) não conta.
update tarefa set status = 'feita', feita_em = now() where vinculo_id = (select id from ids where k = 'p1');
select ok((select providenciar_ate is null and status = 'pendente' from obra_providencia
           where id = (select id from ids where k = 'p2')), 'P2 pendente e sem prazo');
delete from aviso_disparo where tipo in ('acoes', 'acoes_equipe');
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from av where tipo = 'acoes_equipe'),
  '1 atrasada.', 'providência com providenciar_ate null não conta');

-- (e) P2 vence hoje, mas a atividade dela está concluída: não conta.
update obra_providencia set providenciar_ate = '2031-01-08' where id = (select id from ids where k = 'p2');
update obra_atividade set concluida_em = '2031-01-07 10:00-03'
  where id = (select atividade_id from obra_providencia where id = (select id from ids where k = 'p2'));
delete from aviso_disparo where tipo in ('acoes', 'acoes_equipe');
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from av where tipo = 'acoes_equipe'),
  '1 atrasada.', 'providência de atividade concluída não conta');

-- Lembrete excluído (exclusão lógica) também não conta, como no app.
update obra_providencia set providenciar_ate = '2031-01-08', deleted_at = now()
  where id = (select id from ids where k = 'p3');
delete from aviso_disparo where tipo in ('acoes', 'acoes_equipe');
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from av where tipo = 'acoes_equipe'),
  '1 atrasada.', 'providência excluída não conta');

-- Controle: a mesma P3 sem exclusão conta como "vence hoje".
update obra_providencia set deleted_at = null where id = (select id from ids where k = 'p3');
delete from aviso_disparo where tipo in ('acoes', 'acoes_equipe');
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from av where tipo = 'acoes_equipe'),
  '1 atrasada e 1 vence hoje.', 'providência sem dono que vence hoje entra no total');

select * from finish();
rollback;
