-- Prestador vira sugestão (pgTAP): nome novo cria; repetir em outra atividade
-- incrementa; regravar o mesmo nome na mesma atividade não conta de novo.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'gestor@prestador.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000a7', 'Gestor Prestador', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
select gerar_obra(
  (select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02',
  'Obra Prestador',
  (select id from modelo where nome = 'Modelo 1 · CDC completo')
);

create temp table duas as
  select oa.id, row_number() over (order by oa.ordem) as n
  from obra_atividade oa join obra o on o.id = oa.obra_id
  where o.nome = 'Obra Prestador' and oa.pai_id is null
  order by oa.ordem limit 2;

update obra_atividade set prestador = ' Zé Teste Prestador ' where id = (select id from duas where n = 1);
select is(
  (select usos from sugestao where tipo = 'prestador' and texto = 'Zé Teste Prestador'),
  1,
  'nome novo vira sugestão (sem espaços nas pontas)'
);

update obra_atividade set prestador = 'Zé Teste Prestador' where id = (select id from duas where n = 2);
select is(
  (select usos from sugestao where tipo = 'prestador' and texto = 'Zé Teste Prestador'),
  2,
  'usar em outra atividade incrementa'
);

update obra_atividade set prestador = 'Zé Teste Prestador' where id = (select id from duas where n = 2);
select is(
  (select usos from sugestao where tipo = 'prestador' and texto = 'Zé Teste Prestador'),
  2,
  'regravar o mesmo nome não conta de novo'
);

select * from finish();
rollback;
