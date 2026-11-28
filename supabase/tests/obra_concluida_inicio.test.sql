-- Obra concluída e início da obra (pgTAP): a equipe muda o início, mas não
-- conclui; ninguém muda status nem início por update direto; concluir dá as
-- pendências abertas como resolvidas e tira a obra da reunião aberta; o
-- Desfazer reabre tudo. Requer o seed de homologação (Modelo 1).

begin;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000001c1', 'gestor@concluida.contro'),
  ('00000000-0000-0000-0000-0000000001c2', 'equipe@concluida.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000001c1', 'Gestor Concluida', 'gestor'),
  ('00000000-0000-0000-0000-0000000001c2', 'Equipe Concluida', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001c1","role":"authenticated"}';
create temp table o as select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-10', 'Obra Concluida', (select id from modelo where nome = 'Modelo 1 · CDC completo')) as id;
create temp table r as select abrir_reuniao('2026-11-30') as id;
reset role;
create temp table a as
  select id from obra_atividade where obra_id = (select id from o) and pai_id is null order by ordem limit 1;
update obra_atividade set inicio_manual = '2026-11-17' where id = (select id from a);
insert into pendencia (obra_id, titulo) values ((select id from o), 'Rejunte');
grant select on o, r, a to authenticated;

-- Equipe: muda o início (com as datas manuais), não conclui, não burla.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001c2","role":"authenticated"}';
select throws_ok(
  format($$update obra set status = 'concluida' where id = %L$$, (select id from o)),
  '42501', null, 'equipe não conclui por update direto'
);
select throws_ok(
  format($$update obra set inicio = '2026-11-03' where id = %L$$, (select id from o)),
  '42501', null, 'início não muda por update direto'
);
select throws_ok(format($$select concluir_obra(%L)$$, (select id from o)), '42501', null,
  'equipe não conclui a obra');
select throws_ok(
  format($$select mudar_inicio_obra(%L, '2026-11-07')$$, (select id from o)),
  '22023', null, 'obra não começa no sábado'
);
select lives_ok(
  format($$select mudar_inicio_obra(%L, '2026-11-03', '2026-12-30', %L::jsonb)$$, (select id from o),
    jsonb_build_array(jsonb_build_object('id', (select id from a), 'inicio_manual', '2026-11-10'))),
  'equipe adianta o início da obra'
);
reset role;
select is((select inicio from obra where id = (select id from o)), '2026-11-03'::date, 'início gravado');
select is((select inicio_manual from obra_atividade where id = (select id from a)), '2026-11-10'::date,
  'data manual andou junto');
select is((select entrega_original from obra where id = (select id from o)), '2026-12-30'::date,
  'inauguração planejada andou junto');
select is(
  (select antes ->> 'inicio' from obra_evento where obra_id = (select id from o) and tipo = 'inicio_alterado'),
  '2026-11-10', 'evento guarda o início anterior'
);

-- Gestor conclui: pendência dada como resolvida, obra sai da reunião aberta.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001c1","role":"authenticated"}';
select is(concluir_obra((select id from o)), 1, 'gestor conclui e resolve 1 pendência');
reset role;
select is((select status::text from obra where id = (select id from o)), 'concluida', 'obra concluída');
select is((select status from pendencia where obra_id = (select id from o)), 'fechada', 'pendência resolvida');
select ok(
  not exists (select 1 from reuniao_obra where reuniao_id = (select id from r) and obra_id = (select id from o)),
  'saiu da reunião aberta'
);

-- Desfazer: reabre a obra, a pendência e volta à reunião.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001c1","role":"authenticated"}';
select lives_ok(format($$select reabrir_obra(%L, true)$$, (select id from o)), 'gestor desfaz');
reset role;
select is((select status from pendencia where obra_id = (select id from o)), 'aberta', 'pendência reaberta');
select ok(
  exists (select 1 from reuniao_obra where reuniao_id = (select id from r) and obra_id = (select id from o)),
  'voltou à reunião aberta'
);

select * from finish();
rollback;
