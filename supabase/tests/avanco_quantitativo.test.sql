-- Avanço por quantitativo (pgTAP): quantitativo na atividade, medições do dia e
-- do período, sem sobreposição, até hoje, avanço recalculado (0..99), edição e
-- exclusão lógica com evento, e leitura só para quem vê a obra (RLS).
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000001a1', 'equipe@quant.contro'),
  ('00000000-0000-0000-0000-0000000001a2', 'fora@quant.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000001a1', 'Equipe Quantitativo', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}';
select gerar_obra(
  (select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02',
  'Obra Quantitativo',
  (select id from modelo where nome = 'Modelo 1 · CDC completo')
);
reset role;

create temp table alvo as
  select oa.id from obra_atividade oa join obra o on o.id = oa.obra_id
  where o.nome = 'Obra Quantitativo' and oa.pai_id is null and oa.mapa_antecedencia_du is null
    and not exists (select 1 from obra_fase f where f.id = oa.fase_id and f.preliminar)
  order by oa.ordem limit 1;
grant select on alvo to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}';

select throws_ok(
  $$ select salvar_medicao('00000000-0000-0000-0000-00000000aa01', (select id from alvo), 'dia', '2026-11-03', '2026-11-03', 10, 2) $$,
  '22023', 'A atividade não tem quantitativo',
  'sem quantitativo não lança medição'
);
select lives_ok(
  $$ select definir_quantitativo((select id from alvo), 1000, 'm²', null) $$,
  'define o quantitativo só com quantidade e unidade'
);
select is(
  (select quant_pessoas from obra_atividade where id = (select id from alvo)), null,
  'pessoas previstas ficam vazias'
);
select lives_ok(
  $$ select salvar_medicao('00000000-0000-0000-0000-00000000aa01', (select id from alvo), 'dia', '2026-11-03', '2026-11-03', 120, 5) $$,
  'lança a medição do dia'
);
select lives_ok(
  $$ select salvar_medicao('00000000-0000-0000-0000-00000000aa02', (select id from alvo), 'periodo', '2026-10-26', '2026-10-28', 300, 4) $$,
  'lança um período antigo (antes do início previsto)'
);
select is(
  (select avanco_pct::int from obra_atividade where id = (select id from alvo)), 42,
  'avanço = medido / total (420 de 1000)'
);
select throws_ok(
  $$ select salvar_medicao('00000000-0000-0000-0000-00000000aa03', (select id from alvo), 'periodo', '2026-11-02', '2026-11-04', 50, 5) $$,
  '23P01', 'O período inclui dias já medidos',
  'não sobrepõe dias já medidos'
);
select throws_ok(
  $$ select salvar_medicao('00000000-0000-0000-0000-00000000aa04', (select id from alvo), 'dia',
       (now() at time zone 'America/Sao_Paulo')::date + 7, (now() at time zone 'America/Sao_Paulo')::date + 7, 50, 5) $$,
  '22023', null,
  'não lança dia futuro'
);
select throws_ok(
  $$ select salvar_medicao('00000000-0000-0000-0000-00000000aa05', (select id from alvo), 'dia', '2026-11-07', '2026-11-07', 50, 5) $$,
  '22023', 'O período começa e termina em dia útil',
  'não começa em fim de semana'
);
select lives_ok(
  $$ select salvar_medicao('00000000-0000-0000-0000-00000000aa01', (select id from alvo), 'dia', '2026-11-03', '2026-11-03', 95, 5) $$,
  'corrige a própria medição (não conta como sobreposição)'
);
select is(
  (select avanco_pct::int from obra_atividade where id = (select id from alvo)), 39,
  'avanço recalculado na edição (395 de 1000)'
);
select lives_ok(
  $$ select excluir_medicao('00000000-0000-0000-0000-00000000aa02') $$,
  'exclui a medição (lógico)'
);
select is(
  (select deleted_at is not null from obra_medicao where id = '00000000-0000-0000-0000-00000000aa02'), true,
  'a medição excluída continua guardada'
);
select lives_ok(
  $$ select excluir_medicao('00000000-0000-0000-0000-00000000aa02', true) $$,
  'Desfazer restaura a medição'
);
select is(
  (select count(*)::int from obra_atividade_evento
   where atividade_id = (select id from alvo)
     and tipo in ('quantitativo', 'medicao', 'medicao_editada', 'medicao_excluida', 'medicao_restaurada')),
  6,
  'cada mudança gera um evento na vida da atividade'
);
select is(
  (select prestador is not distinct from (select prestador from obra_atividade where id = (select id from alvo))
   from obra_medicao where id = '00000000-0000-0000-0000-00000000aa01'),
  true,
  'a medição guarda o prestador da atividade'
);

-- Quem não vê a obra não lê as medições.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001a2","role":"authenticated"}';
select is(
  (select count(*)::int from obra_medicao where atividade_id = (select id from alvo)), 0,
  'RLS: sem acesso à obra, não vê as medições'
);

select * from finish();
rollback;
