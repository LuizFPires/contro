-- Apagar obra (pgTAP): só o gestor apaga e restaura; a equipe não consegue nem
-- pela função nem por update direto. Requer o seed de homologação (Modelo 1).

begin;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000fc', 'gestor@apagar.contro'),
  ('00000000-0000-0000-0000-0000000000fd', 'equipe@apagar.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000fc', 'Gestor Apagar', 'gestor'),
  ('00000000-0000-0000-0000-0000000000fd', 'Equipe Apagar', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fc","role":"authenticated"}';
create temp table o as select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra Apagar', (select id from modelo where nome = 'Modelo 1 · CDC completo')) as id;

-- Equipe: não apaga pela função nem por update direto.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fd","role":"authenticated"}';
select throws_ok(format($$select excluir_obra(%L)$$, (select id from o)), '42501', null, 'equipe não apaga obra');
select throws_ok(
  format($$update obra set deleted_at = now() where id = %L$$, (select id from o)),
  '42501', null, 'equipe não apaga por update direto'
);

-- Gestor: apaga (lógico) e restaura.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fc","role":"authenticated"}';
select lives_ok(format($$select excluir_obra(%L)$$, (select id from o)), 'gestor apaga obra');
reset role;
select ok(
  (select deleted_at is not null and excluida_por is not null from obra where id = (select id from o)),
  'exclusão lógica, com quem apagou'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fc","role":"authenticated"}';
select lives_ok(format($$select restaurar_obra(%L)$$, (select id from o)), 'gestor restaura (Desfazer)');
reset role;
select ok((select deleted_at is null from obra where id = (select id from o)), 'obra volta');

select * from finish();
rollback;
