-- Sem atividade bloqueada (pgTAP): conclui com predecessora aberta e lembrete
-- pendente; com subitens abertos, marca os subitens junto; desfazer não depende
-- das sucessoras. Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b9', 'equipe@sembloqueio.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000b9', 'Equipe Sem Bloqueio', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b9","role":"authenticated"}';
select gerar_obra(
  (select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02',
  'Obra Sem Bloqueio',
  (select id from modelo where nome = 'Modelo 1 · CDC completo')
);
reset role;

-- Uma atividade com predecessora aberta, e uma com subitens.
create temp table alvo as
  select oa.id from obra_atividade oa join obra o on o.id = oa.obra_id
  where o.nome = 'Obra Sem Bloqueio' and oa.pai_id is null
    and exists (select 1 from obra_dependencia d where d.atividade_id = oa.id)
    and not exists (select 1 from obra_atividade s where s.pai_id = oa.id)
  order by oa.ordem limit 1;
create temp table comsub as
  select oa.id from obra_atividade oa join obra o on o.id = oa.obra_id
  where o.nome = 'Obra Sem Bloqueio' and oa.pai_id is null
    and exists (select 1 from obra_atividade s where s.pai_id = oa.id)
  order by oa.ordem limit 1;
create temp table pred as
  select d.predecessora_id as id from obra_dependencia d where d.atividade_id = (select id from alvo) limit 1;
grant select on alvo, comsub, pred to authenticated;
-- Garante um lembrete pendente na atividade-alvo.
insert into obra_providencia (obra_id, atividade_id, tipo, descricao, antecedencia_du, status)
  select obra_id, id, 'compra', 'Lembrete de teste', 2, 'pendente' from obra_atividade where id = (select id from alvo);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b9","role":"authenticated"}';

select lives_ok(
  $$ select concluir_atividade((select id from alvo), null) $$,
  'conclui com predecessora aberta e lembrete pendente'
);
select lives_ok(
  $$ select concluir_atividade((select id from pred), null) $$,
  'conclui a predecessora depois (fora de ordem)'
);
select lives_ok(
  $$ select desfazer_conclusao((select id from pred)) $$,
  'desfaz mesmo com a sucessora concluída'
);

select lives_ok(
  $$ select concluir_atividade((select id from comsub), null) $$,
  'conclui atividade com subitens abertos'
);
select is(
  (select count(*)::int from obra_atividade where pai_id = (select id from comsub) and deleted_at is null and concluida_em is null),
  0,
  'os subitens abertos são marcados junto'
);

select * from finish();
rollback;
