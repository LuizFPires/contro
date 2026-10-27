-- Mapa de coleta como check (pgTAP): marcar pronto e desfazer não mexem nos
-- pontos da obra; atividade comum continua valendo 50.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f9', 'gestor@mapacheck.contro');
insert into pessoa (user_id, nome, perfil) values ('00000000-0000-0000-0000-0000000000f9', 'Gestor Mapa', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f9","role":"authenticated"}';
create temp table o as select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra Mapa Check', (select id from modelo where nome = 'Modelo 1 · CDC completo')) as id;
create temp table m as select a.id from obra_atividade a
  where a.obra_id = (select id from o) and a.mapa_antecedencia_du is not null order by a.ordem limit 1;
create temp table c as select a.id from obra_atividade a join obra_fase f on f.id = a.fase_id
  where a.obra_id = (select id from o) and not f.preliminar and a.pai_id is null order by f.ordem, a.ordem limit 1;

select is(
  (select (concluir_atividade((select id from m), null) ->> 'xp')::int),
  0,
  'marcar o mapa como pronto não vale pontos'
);
select is((select xp from obra where id = (select id from o)), 0, 'xp da obra segue 0');
select desfazer_conclusao((select id from m));
select is((select xp from obra where id = (select id from o)), 0, 'desmarcar o mapa não tira pontos');
select is(
  (select (concluir_atividade((select id from c), null) ->> 'xp')::int),
  50,
  'atividade da obra continua valendo 50'
);
reset role;

select * from finish();
rollback;
