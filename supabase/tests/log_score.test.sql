-- Log e Score (pgTAP): motivo do replanejamento e índices dos eventos por data.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'gestor@logscore.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000f1', 'Gestor Log Score', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select gerar_obra(
  (select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02',
  'Obra Log Score',
  (select id from modelo where nome = 'Modelo 1 · CDC completo')
);

-- Cria sem p_motivo (assinatura antiga, só parâmetros nomeados antigos).
select lives_ok(
  $$ select salvar_tarefa(
       p_id => '00000000-0000-0000-0000-0000000000f2',
       p_obra_id => (select id from obra where nome = 'Obra Log Score'),
       p_texto => 'Tarefa log', p_responsavel_id => null, p_prazo => '2026-11-05') $$,
  'chamada sem p_motivo continua funcionando'
);

select salvar_tarefa('00000000-0000-0000-0000-0000000000f2', (select id from obra where nome = 'Obra Log Score'),
  'Tarefa log', null, '2026-11-06', null, null, null, null, null, null, 'Chuva forte');
select is(
  (select depois->>'motivo' from tarefa_evento where tarefa_id = '00000000-0000-0000-0000-0000000000f2' and tipo = 'replanejada' and depois->>'prazo' = '2026-11-06'),
  'Chuva forte',
  'replanejar com motivo grava depois->>motivo'
);

select salvar_tarefa('00000000-0000-0000-0000-0000000000f2', (select id from obra where nome = 'Obra Log Score'),
  'Tarefa log', null, '2026-11-09');
select ok(
  (select (depois ? 'motivo') and depois->>'motivo' is null from tarefa_evento where tarefa_id = '00000000-0000-0000-0000-0000000000f2' and tipo = 'replanejada' and depois->>'prazo' = '2026-11-09'),
  'replanejar sem motivo grava motivo null'
);

select salvar_tarefa('00000000-0000-0000-0000-0000000000f2', (select id from obra where nome = 'Obra Log Score'),
  'Tarefa log', null, '2026-11-10', null, null, null, null, null, null, repeat('x', 200));
select is(
  (select length(depois->>'motivo') from tarefa_evento where tarefa_id = '00000000-0000-0000-0000-0000000000f2' and tipo = 'replanejada' and depois->>'prazo' = '2026-11-10'),
  120,
  'motivo de 200 caracteres fica com 120'
);

select ok(exists (select 1 from pg_indexes where indexname = 'tarefa_evento_em_idx'), 'índice tarefa_evento_em_idx');
select ok(exists (select 1 from pg_indexes where indexname = 'pendencia_evento_em_idx'), 'índice pendencia_evento_em_idx');
select ok(exists (select 1 from pg_indexes where indexname = 'obra_atividade_evento_em_idx'), 'índice obra_atividade_evento_em_idx');

select * from finish();
rollback;
