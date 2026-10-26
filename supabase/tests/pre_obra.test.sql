-- Pré-obra (pgTAP): os modelos têm as fases 1 e 2 preliminares; a obra nova
-- copia a marca de pré-obra e os mapas apontam para a atividade da própria obra.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(5);

select is(
  (select string_agg(f.titulo, ' | ' order by f.ordem) from modelo_fase f join modelo m on m.id = f.modelo_id
   where m.nome = 'Modelo 1 · CDC completo' and f.preliminar),
  'Orçamento | Mapa de coleta',
  'Modelo 1: fases 1 e 2 são o pré-obra'
);
select is(
  (select count(*)::int from modelo_atividade a join modelo m on m.id = a.modelo_id
   where m.nome = 'Modelo 1 · CDC completo' and a.mapa_alvo_id is not null),
  18,
  'Modelo 1 tem os 18 mapas de coleta'
);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f7', 'gestor@preobra.contro');
insert into pessoa (user_id, nome, perfil) values ('00000000-0000-0000-0000-0000000000f7', 'Gestor Pré-obra', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f7","role":"authenticated"}';
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra Pré-obra', (select id from modelo where nome = 'Modelo 1 · CDC completo'));
reset role;

select is(
  (select count(*)::int from obra_fase f join obra o on o.id = f.obra_id where o.nome = 'Obra Pré-obra' and f.preliminar),
  2,
  'a obra nova copia as 2 fases do pré-obra'
);
select is(
  (select count(*)::int from obra_atividade a join obra o on o.id = a.obra_id
   join obra_atividade alvo on alvo.id = a.mapa_alvo_id
   where o.nome = 'Obra Pré-obra' and alvo.obra_id = o.id),
  18,
  'os mapas apontam para atividades da própria obra'
);
select is(
  (select mapa_antecedencia_du from obra_atividade a join obra o on o.id = a.obra_id
   where o.nome = 'Obra Pré-obra' and a.nome = 'Equipamentos de ar-condicionado'),
  30,
  'antecedência copiada do modelo'
);

select * from finish();
rollback;
