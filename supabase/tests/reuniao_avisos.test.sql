-- Reunião e avisos (pgTAP): gerar_avisos cria os avisos certos no horário de
-- São Paulo, uma vez por pessoa/dia, respeitando "quem recebe"; tarefas só para
-- o responsável; nada no fim de semana; equipe não altera a configuração.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'gestor@avisos.contro'),
  ('00000000-0000-0000-0000-0000000000a2', 'equipe@avisos.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000a1', 'Gestor Avisos', 'gestor'),
  ('00000000-0000-0000-0000-0000000000a2', 'Equipe Avisos', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2031-01-06', 'Obra Avisos', (select id from modelo where nome = 'Modelo 1 · CDC completo'));

-- Equipe tenta mudar o dia da reunião: a RLS não deixa (nenhuma linha muda).
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
update config_avisos set reuniao_dia = 5 where id;
reset role;
select is((select reuniao_dia::int from config_avisos), 1, 'equipe não altera a configuração');

-- Tarefa da equipe vencendo na segunda 06/01/2031.
insert into tarefa (obra_id, texto, responsavel_id, prazo)
values ((select id from obra where nome = 'Obra Avisos'), 'Ligar para o vidraceiro',
        (select id from pessoa where user_id = '00000000-0000-0000-0000-0000000000a2'), '2031-01-06');

create temp view meus as
  select tipo, dia, user_id from aviso_disparo
  where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');

-- Segunda 06/01/2031, 08:05 em São Paulo (11:05 UTC).
select gerar_avisos('2031-01-06 11:05:00+00');
select is((select count(*)::int from meus where tipo = 'reuniao_manha'), 2,
  'lembrete da manhã para todos no dia da reunião');
select is((select count(*)::int from meus where tipo = 'resumo'), 2, 'resumo da manhã para todos');
select is(
  (select array_agg(user_id::text) from meus where tipo = 'tarefas'),
  array['00000000-0000-0000-0000-0000000000a2'], 'tarefa de hoje só para o responsável'
);
select is((select count(*)::int from meus where tipo = 'reuniao_antes'), 0, 'antes de começar ainda não');

-- Mesma rodada de novo: nada duplicado.
select gerar_avisos('2031-01-06 11:10:00+00');
select is((select count(*)::int from meus where dia = '2031-01-06'), 5, 'cron repetido não duplica');

-- 15:05 em São Paulo: 1 hora antes da reunião das 16h.
select gerar_avisos('2031-01-06 18:05:00+00');
select is((select count(*)::int from meus where tipo = 'reuniao_antes'), 2, 'lembrete 1 hora antes');

-- Resumo só para gestores, na terça.
update config_avisos set resumo_para = 'gestores' where id;
select gerar_avisos('2031-01-07 10:35:00+00');
select is(
  (select array_agg(user_id::text) from meus where tipo = 'resumo' and dia = '2031-01-07'),
  array['00000000-0000-0000-0000-0000000000a1'], 'resumo só para gestores quando configurado'
);

-- Sábado: nada.
select gerar_avisos('2031-01-11 11:05:00+00');
select is((select count(*)::int from meus where dia = '2031-01-11'), 0, 'sem avisos no fim de semana');

select ok(
  not has_function_privilege('authenticated', 'gerar_avisos(timestamptz)', 'execute'),
  'app não dispara avisos (só o cron)'
);

select * from finish();
rollback;
