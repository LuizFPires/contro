-- Adicionar e excluir atividade na obra (pgTAP): o card novo entra no fim da
-- fase com a dependência; a exclusão é lógica, leva os subitens e se desfaz;
-- quem não é membro não mexe. Requer o seed de homologação (Modelo 1).

begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000fa', 'gestor@cards.contro'),
  ('00000000-0000-0000-0000-0000000000fb', 'estranho@cards.contro');
insert into pessoa (user_id, nome, perfil) values ('00000000-0000-0000-0000-0000000000fa', 'Gestor Cards', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fa","role":"authenticated"}';
create temp table o as select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra Cards', (select id from modelo where nome = 'Modelo 1 · CDC completo')) as id;
create temp table f as select fa.id from obra_fase fa
  where fa.obra_id = (select id from o) and not fa.preliminar order by fa.ordem limit 1;
create temp table p as select a.id from obra_atividade a
  where a.fase_id = (select id from f) and a.pai_id is null order by a.ordem limit 1;
create temp table nova as select adicionar_atividade_obra(
  (select id from o), (select id from f), '  Impermeabilização  ', 3, array[(select id from p)]) as id;

select is((select nome from obra_atividade where id = (select id from nova)), 'Impermeabilização', 'nome sem espaços nas pontas');
select is(
  (select ordem from obra_atividade where id = (select id from nova)),
  (select max(ordem) from obra_atividade where fase_id = (select id from f) and pai_id is null),
  'entra no fim da fase'
);
select is(
  (select predecessora_id from obra_dependencia where atividade_id = (select id from nova)),
  (select id from p),
  'grava a dependência'
);
select throws_ok(
  format($$select adicionar_atividade_obra(%L, %L, '', 3)$$, (select id from o), (select id from f)),
  '22023', null, 'nome vazio é recusado'
);

-- Atividade com subitem: exclui junto e o Desfazer traz de volta.
insert into obra_atividade (obra_id, fase_id, ordem, nome, duracao_du, pai_id, em_sequencia)
values ((select id from o), (select id from f), 1, 'Subitem teste', 1, (select id from nova), true);
select excluir_atividade_obra((select id from nova));
select ok(
  (select bool_and(deleted_at is not null) from obra_atividade where id = (select id from nova) or pai_id = (select id from nova)),
  'exclusão lógica da atividade e dos subitens'
);
select ok(exists (select 1 from obra_atividade_evento where atividade_id = (select id from nova) and tipo = 'excluida'), 'evento de exclusão');
select restaurar_atividade_obra((select id from nova));
select ok(
  (select bool_and(deleted_at is null) from obra_atividade where id = (select id from nova) or pai_id = (select id from nova)),
  'Desfazer traz a atividade e os subitens de volta'
);

-- Quem não é membro não adiciona nem exclui.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fb","role":"authenticated"}';
select throws_ok(
  format($$select adicionar_atividade_obra(%L, %L, 'X', 1)$$, (select id from o), (select id from f)),
  '42501', null, 'não membro não adiciona'
);
select throws_ok(
  format($$select excluir_atividade_obra(%L)$$, (select id from nova)),
  '42501', null, 'não membro não exclui'
);
reset role;

select * from finish();
rollback;
