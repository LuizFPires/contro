-- Conclusão com ou sem foto (pgTAP). Roda com: supabase test db
--   - concluir sem foto funciona e deixa foto_conclusao_id nulo;
--   - qualquer membro reabre (volta para pendente); reabrir aberta é recusado;
--   - anexar foto só em atividade concluída, só uma vez, e a foto é da obra.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'gestor@semfoto.contro'),
  ('00000000-0000-0000-0000-0000000000c2', 'equipe@semfoto.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000c1', 'Gestor Sem Foto', 'gestor'),
  ('00000000-0000-0000-0000-0000000000c2', 'Equipe Sem Foto', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select gerar_obra(
  (select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02',
  'Obra Sem Foto',
  (select id from modelo where nome = 'Modelo 1 · CDC completo')
);
reset role;

-- Atividade de partida (sem predecessoras, sem subitens) com os lembretes feitos.
create temp table alvo as
  select oa.id, oa.obra_id
  from obra_atividade oa join obra o on o.id = oa.obra_id
  where o.nome = 'Obra Sem Foto' and oa.pai_id is null
    and not exists (select 1 from obra_dependencia d where d.atividade_id = oa.id)
    and not exists (select 1 from obra_atividade s where s.pai_id = oa.id)
  order by oa.ordem limit 1;
grant select on alvo to authenticated;
update obra_providencia set status = 'feito' where atividade_id = (select id from alvo);
insert into foto (id, obra_id, storage_path)
  values ('00000000-0000-0000-0000-0000000000f1', (select obra_id from alvo), 'teste/f1.jpg');

set local role authenticated;

-- EQUIPE conclui sem foto.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select lives_ok(
  $$ select concluir_atividade((select id from alvo), null) $$,
  'conclui sem foto'
);
select ok(
  (select concluida_em is not null and foto_conclusao_id is null from obra_atividade where id = (select id from alvo)),
  'fica concluída e sem foto'
);

-- GESTOR (não concluiu) também volta a atividade para pendente.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select lives_ok(
  $$ select desfazer_conclusao((select id from alvo)) $$,
  'qualquer membro volta a atividade para pendente'
);

-- Já aberta: reabrir de novo é recusado.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select throws_ok(
  $$ select desfazer_conclusao((select id from alvo)) $$,
  '42501', null,
  'reabrir atividade já aberta é recusado'
);
select ok(
  (select concluida_em is null from obra_atividade where id = (select id from alvo)),
  'desfazer reabre a atividade'
);

-- Anexar foto só em atividade concluída.
select throws_ok(
  $$ select anexar_foto_conclusao((select id from alvo), '00000000-0000-0000-0000-0000000000f1') $$,
  '42501', null,
  'não anexa foto em atividade aberta'
);

-- Conclui de novo sem foto e anexa depois.
select lives_ok(
  $$ select concluir_atividade((select id from alvo), null) $$,
  'conclui de novo sem foto'
);
select lives_ok(
  $$ select anexar_foto_conclusao((select id from alvo), '00000000-0000-0000-0000-0000000000f1') $$,
  'anexa a foto depois'
);
select is(
  (select foto_conclusao_id from obra_atividade where id = (select id from alvo)),
  '00000000-0000-0000-0000-0000000000f1'::uuid,
  'a foto anexada fica na conclusão'
);
select throws_ok(
  $$ select anexar_foto_conclusao((select id from alvo), '00000000-0000-0000-0000-0000000000f1') $$,
  '23505', null,
  'não anexa uma segunda foto'
);

select * from finish();
rollback;
