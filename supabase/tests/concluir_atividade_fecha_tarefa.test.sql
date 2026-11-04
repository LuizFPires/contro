-- Concluir a atividade fecha as tarefas abertas vinculadas a ela (pgTAP):
-- grava o evento 'concluida'; tarefa de providência e tarefa já feita não
-- mudam. Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c7', 'gestor@fechatarefa.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000c7', 'Gestor Fecha Tarefa', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated"}';
select gerar_obra(
  (select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02',
  'Obra Fecha Tarefa',
  (select id from modelo where nome = 'Modelo 1 · CDC completo')
);
reset role;

create temp table alvo as
  select oa.id, oa.obra_id from obra_atividade oa join obra o on o.id = oa.obra_id
  where o.nome = 'Obra Fecha Tarefa' and oa.pai_id is null and oa.mapa_antecedencia_du is null
  order by oa.ordem limit 1;

-- Tarefa aberta da atividade, tarefa já feita da atividade e tarefa de providência
-- (com o mesmo id de vínculo da atividade, para provar que o tipo é conferido).
insert into tarefa (id, obra_id, texto, prazo, vinculo_tipo, vinculo_id) select
  '00000000-0000-0000-0000-00000000c701', obra_id, 'Atividade: alvo', '2026-11-10', 'atividade', id from alvo;
insert into tarefa (id, obra_id, texto, prazo, vinculo_tipo, vinculo_id, status, feita_em) select
  '00000000-0000-0000-0000-00000000c702', obra_id, 'Atividade: já feita', '2026-11-10', 'atividade', id,
  'feita', '2026-11-03 10:00+00' from alvo;
insert into tarefa (id, obra_id, texto, prazo, vinculo_tipo, vinculo_id) select
  '00000000-0000-0000-0000-00000000c703', obra_id, 'Compra: teste', '2026-11-10', 'providencia', id from alvo;
grant select on alvo to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated"}';
select lives_ok(
  $$ select concluir_atividade((select id from alvo), null) $$,
  'conclui a atividade'
);
reset role;

select is(
  (select status from tarefa where id = '00000000-0000-0000-0000-00000000c701'),
  'feita',
  'a tarefa aberta vinculada à atividade fecha junto'
);
select is(
  (select count(*)::int from tarefa_evento
   where tarefa_id = '00000000-0000-0000-0000-00000000c701' and tipo = 'concluida'
     and por = (select id from pessoa where user_id = '00000000-0000-0000-0000-0000000000c7')),
  1,
  'grava o evento concluida da tarefa, por quem concluiu a atividade'
);
select is(
  (select status from tarefa where id = '00000000-0000-0000-0000-00000000c703'),
  'aberta',
  'tarefa de providência não muda'
);
select is(
  (select feita_em from tarefa where id = '00000000-0000-0000-0000-00000000c702'),
  '2026-11-03 10:00+00'::timestamptz,
  'tarefa já feita não muda'
);
select is(
  (select count(*)::int from tarefa_evento where tarefa_id = '00000000-0000-0000-0000-00000000c702'),
  0,
  'tarefa já feita não ganha evento'
);

select * from finish();
rollback;
