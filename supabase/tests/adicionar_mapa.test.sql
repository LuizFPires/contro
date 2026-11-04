-- Item do Mapa de coleta na obra (pgTAP): entra na fase preliminar "Mapa de
-- coleta" com a antecedência e as atividades que libera; repetir a op devolve o
-- mesmo item; alvos de outra obra, subitem ou do pré-obra são recusados; a
-- exclusão é lógica e as ligações ficam (o cliente ignora as do item excluído);
-- quem não é membro não adiciona. Requer o seed de homologação (Modelo 1).

begin;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'gestor@mapa.contro'),
  ('00000000-0000-0000-0000-0000000000d2', 'estranho@mapa.contro');
insert into pessoa (user_id, nome, perfil) values ('00000000-0000-0000-0000-0000000000d1', 'Gestor Mapa', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
create temp table o as select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra Mapa', (select id from modelo where nome = 'Modelo 1 · CDC completo')) as id;
create temp table o2 as select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra Mapa 2', (select id from modelo where nome = 'Modelo 1 · CDC completo')) as id;
-- Duas atividades de obra (fase não preliminar) desta obra.
create temp table alvos as select a.id, row_number() over (order by fa.ordem, a.ordem) as n
  from obra_atividade a join obra_fase fa on fa.id = a.fase_id
  where a.obra_id = (select id from o) and not fa.preliminar and a.pai_id is null and a.deleted_at is null
  order by fa.ordem, a.ordem limit 2;
create temp table novo as select adicionar_mapa_obra(
  (select id from o), '  Gesso: gesseiro e materiais  ', 5, 10,
  array[(select id from alvos where n = 1), (select id from alvos where n = 2), (select id from alvos where n = 1)],
  '00000000-0000-0000-0000-00000000d0a1') as id;

select is((select id from novo), '00000000-0000-0000-0000-00000000d0a1'::uuid, 'devolve o id da op');
select is((select count(*)::int from obra_mapa_libera where mapa_id = (select id from novo)), 2,
  'grava as 2 atividades liberadas (sem repetir)');
select is((select mapa_antecedencia_du from obra_atividade where id = (select id from novo)), 10, 'grava a antecedência');
select is(
  (select fa.titulo from obra_atividade a join obra_fase fa on fa.id = a.fase_id where a.id = (select id from novo)),
  'Mapa de coleta', 'entra na fase Mapa de coleta'
);
select is(
  (select array[nome, duracao_du::text, em_sequencia::text] from obra_atividade where id = (select id from novo)),
  array['Gesso: gesseiro e materiais', '5', 'true'], 'nome sem espaços, prazo e em sequência'
);
select is(
  (select ordem from obra_atividade where id = (select id from novo)),
  (select max(a.ordem) from obra_atividade a where a.fase_id = (select fase_id from obra_atividade where id = (select id from novo))
     and a.pai_id is null),
  'entra no fim da fase'
);
select is(
  (select jsonb_array_length(depois -> 'libera') from obra_atividade_evento
   where atividade_id = (select id from novo) and tipo = 'criada'),
  2, 'evento criada com as atividades liberadas'
);

-- Repetição da mesma op (offline): mesmo id, nada duplicado.
select is(adicionar_mapa_obra((select id from o), 'Gesso: gesseiro e materiais', 5, 10,
  array[(select id from alvos where n = 1)], '00000000-0000-0000-0000-00000000d0a1'),
  '00000000-0000-0000-0000-00000000d0a1'::uuid, 'mesmo p_id devolve o mesmo item');
select is(
  (select array[(select count(*)::int from obra_mapa_libera where mapa_id = (select id from novo)),
                (select count(*)::int from obra_atividade_evento where atividade_id = (select id from novo) and tipo = 'criada')]),
  array[2, 1], 'repetição não duplica ligações nem evento'
);

-- Alvos inválidos.
select throws_ok(
  format($$select adicionar_mapa_obra(%L, 'X', 5, 10, array[%L]::uuid[])$$, (select id from o),
    (select a.id from obra_atividade a join obra_fase fa on fa.id = a.fase_id
     where a.obra_id = (select id from o2) and not fa.preliminar and a.pai_id is null limit 1)),
  '23503', null, 'alvo de outra obra é recusado'
);
insert into obra_atividade (id, obra_id, fase_id, ordem, nome, duracao_du, pai_id, em_sequencia)
select '00000000-0000-0000-0000-00000000d0b1', (select id from o), a.fase_id, 1, 'Subitem alvo', 1, a.id, true
from obra_atividade a where a.id = (select id from alvos where n = 1);
select throws_ok(
  format($$select adicionar_mapa_obra(%L, 'X', 5, 10, array['00000000-0000-0000-0000-00000000d0b1']::uuid[])$$,
    (select id from o)),
  '23503', null, 'subitem não é alvo'
);
select throws_ok(
  format($$select adicionar_mapa_obra(%L, 'X', 5, 10, array[%L]::uuid[])$$, (select id from o),
    (select a.id from obra_atividade a join obra_fase fa on fa.id = a.fase_id
     where a.obra_id = (select id from o) and fa.preliminar and a.pai_id is null and a.deleted_at is null limit 1)),
  '23503', null, 'atividade do pré-obra não é alvo'
);
select throws_ok(
  format($$select adicionar_mapa_obra(%L, 'X', 5, 10, '{}'::uuid[])$$, (select id from o)),
  '22023', null, 'sem atividade liberada é recusado'
);

-- Exclusão lógica: o item sai, as ligações ficam (o cliente ignora as de item excluído).
select excluir_atividade_obra((select id from novo));
select ok((select deleted_at is not null from obra_atividade where id = (select id from novo)), 'exclusão lógica do item');
select is((select count(*)::int from obra_mapa_libera where mapa_id = (select id from novo)), 2,
  'ligações ficam guardadas para o Desfazer');

-- Quem não é membro não adiciona.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select throws_ok(
  format($$select adicionar_mapa_obra(%L, 'X', 5, 10, array[%L]::uuid[])$$, (select id from o),
    (select id from alvos where n = 2)),
  '42501', null, 'não membro não adiciona'
);

select * from finish();
rollback;
