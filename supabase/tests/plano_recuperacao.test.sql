-- Plano de recuperação (pgTAP): fixar a data original uma vez só; aplicar
-- redução de prazo e paralelismo com evento; tarefas do plano; sem login, nada.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e7', 'gestor@plano.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000e7', 'Gestor Plano', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e7","role":"authenticated"}';
select gerar_obra(
  (select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02',
  'Obra Plano',
  (select id from modelo where nome = 'Modelo 1 · CDC completo')
);
reset role;

create temp table dep as
  select d.atividade_id, d.predecessora_id, d.obra_id
  from obra_dependencia d join obra o on o.id = d.obra_id
  join obra_atividade a on a.id = d.atividade_id
  where o.nome = 'Obra Plano' and a.duracao_du >= 3 and not exists (select 1 from obra_atividade s where s.pai_id = a.id)
  limit 1;
grant select on dep to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e7","role":"authenticated"}';

select lives_ok($$ select fixar_entrega_original((select obra_id from dep), '2026-12-03') $$, 'fixa a data original');
select fixar_entrega_original((select obra_id from dep), '2026-12-10');
select is((select entrega_original::text from obra where id = (select obra_id from dep)), '2026-12-03', 'não sobrescreve a data original');

select lives_ok($$
  select aplicar_plano_recuperacao(
    (select obra_id from dep), '2026-12-03',
    jsonb_build_array(jsonb_build_object('atividade_id', (select atividade_id from dep), 'duracao_du', 2)),
    jsonb_build_array(jsonb_build_object('atividade_id', (select atividade_id from dep),
                                         'predecessora_id', (select predecessora_id from dep),
                                         'defasagem_du', -2)),
    jsonb_build_array(jsonb_build_object('texto', 'Reforçar a equipe', 'atividade_id', (select atividade_id from dep), 'prazo', '2026-11-20'))
  ) $$, 'aplica o plano');
select is((select duracao_du from obra_atividade where id = (select atividade_id from dep)), 2, 'reduz a duração');
select is((select defasagem_du from obra_dependencia where atividade_id = (select atividade_id from dep) and predecessora_id = (select predecessora_id from dep)), -2, 'grava o paralelismo');
select is((select count(*)::int from obra_atividade_evento where atividade_id = (select atividade_id from dep) and tipo = 'plano_recuperacao'), 2, 'um evento por mudança');
select is((select origem_texto from tarefa where obra_id = (select obra_id from dep) and texto = 'Reforçar a equipe'), 'Plano de recuperação', 'cria a providência do plano');

select throws_ok($$
  select aplicar_plano_recuperacao((select obra_id from dep), null,
    jsonb_build_array(jsonb_build_object('atividade_id', (select atividade_id from dep), 'duracao_du', 0)))
  $$, '23514', null, 'duração zero é recusada');

select * from finish();
rollback;
