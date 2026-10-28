-- Avanço parcial (pgTAP): definir_avanco grava 0..99 com evento, é idempotente
-- pela op, recusa 100/concluída/mapa e não deixa anônimo chamar.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(8);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000fa', 'equipe@avanco.contro');
insert into pessoa (user_id, nome, perfil) values ('00000000-0000-0000-0000-0000000000fa', 'Equipe Avanço', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fa","role":"authenticated"}';
create temp table o as select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra Avanço', (select id from modelo where nome = 'Modelo 1 · CDC completo')) as id;
create temp table c as select a.id from obra_atividade a join obra_fase f on f.id = a.fase_id
  where a.obra_id = (select id from o) and not f.preliminar and a.pai_id is null
    and a.mapa_antecedencia_du is null order by f.ordem, a.ordem limit 1;
create temp table m as select a.id from obra_atividade a
  where a.obra_id = (select id from o) and a.mapa_antecedencia_du is not null order by a.ordem limit 1;

select definir_avanco((select id from c), 25, '00000000-0000-0000-0000-0000000a0001');
select is((select avanco_pct::int from obra_atividade where id = (select id from c)), 25, 'grava 25%');
select definir_avanco((select id from c), 50, '00000000-0000-0000-0000-0000000a0001');
select is((select avanco_pct::int from obra_atividade where id = (select id from c)), 25, 'mesma op repetida não regrava');
select is(
  (select count(*)::int from obra_atividade_evento where atividade_id = (select id from c) and tipo = 'avanco'),
  1, 'um evento de avanço'
);
select throws_ok(
  format('select definir_avanco(%L, 100)', (select id from c)), '22023', null, '100% é concluir, não avanço'
);
select throws_ok(
  format('select definir_avanco(%L, 50)', (select id from m)), '23503', null, 'mapa de coleta não tem avanço'
);
select concluir_atividade((select id from c), null);
select throws_ok(
  format('select definir_avanco(%L, 50)', (select id from c)), '23505', null, 'concluída não recebe avanço'
);
select desfazer_conclusao((select id from c));
select is((select avanco_pct::int from obra_atividade where id = (select id from c)), 25, 'reabrir mantém o avanço');
reset role;

select ok(
  not has_function_privilege('anon', 'definir_avanco(uuid, int, uuid)', 'execute'),
  'anônimo não chama'
);

select * from finish();
rollback;
