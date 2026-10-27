-- Lembrete com duração (pgTAP): gerar_obra e duplicar_modelo copiam quantos
-- dias leva para providenciar; valor negativo é recusado.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(4);

update modelo_providencia set duracao_du = 5
where id = (select pr.id from modelo_providencia pr join modelo m on m.id = pr.modelo_id
            where m.nome = 'Modelo 1 · CDC completo' order by pr.id limit 1);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f8', 'gestor@duracao.contro');
insert into pessoa (user_id, nome, perfil) values ('00000000-0000-0000-0000-0000000000f8', 'Gestor Duração', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f8","role":"authenticated"}';
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra Duração', (select id from modelo where nome = 'Modelo 1 · CDC completo'));
create temp table copia as select duplicar_modelo((select id from modelo where nome = 'Modelo 1 · CDC completo'), 'Cópia Duração') as id;
reset role;

select is(
  (select count(*)::int from obra_providencia p join obra o on o.id = p.obra_id
   where o.nome = 'Obra Duração' and p.duracao_du = 5),
  1,
  'gerar_obra copia a duração do lembrete'
);
select is(
  (select count(*)::int from modelo_providencia where modelo_id = (select id from copia) and duracao_du = 5),
  1,
  'duplicar_modelo copia a duração do lembrete'
);
select is(
  (select count(*)::int from obra_providencia p join obra o on o.id = p.obra_id
   where o.nome = 'Obra Duração' and p.duracao_du = 0),
  (select count(*)::int - 1 from modelo_providencia pr join modelo m on m.id = pr.modelo_id
   where m.nome = 'Modelo 1 · CDC completo'),
  'os demais lembretes ficam com 0 (só o prazo)'
);
select throws_ok(
  $$update modelo_providencia set duracao_du = -1 where modelo_id = (select id from copia)$$,
  '23514',
  null,
  'duração negativa é recusada'
);

select * from finish();
rollback;
