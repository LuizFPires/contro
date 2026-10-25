-- restaurar_modelo (Desfazer da exclusão). Roda com: supabase test db
-- Só o gestor restaura; a linha excluída volta a ter deleted_at null.

begin;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'g@rm.contro'),
  ('00000000-0000-0000-0000-0000000000e2', 'e@rm.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000e1', 'Gestor RM', 'gestor'),
  ('00000000-0000-0000-0000-0000000000e2', 'Equipe RM', 'equipe');
-- Modelos já excluídos (inseridos como owner, sem RLS).
insert into modelo (id, nome, ordem, deleted_at) values
  ('00000000-0000-0000-0000-0000000000f1', 'Excluído 1', 101, now()),
  ('00000000-0000-0000-0000-0000000000f2', 'Excluído 2', 102, now());

set local role authenticated;

-- GESTOR restaura f1
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select lives_ok(
  $$ select restaurar_modelo('00000000-0000-0000-0000-0000000000f1') $$,
  'gestor restaura o modelo'
);
select is(
  (select deleted_at from modelo where id = '00000000-0000-0000-0000-0000000000f1'),
  null::timestamptz,
  'modelo volta a ter deleted_at null'
);

-- EQUIPE não restaura f2
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select throws_ok(
  $$ select restaurar_modelo('00000000-0000-0000-0000-0000000000f2') $$,
  '42501',
  null,
  'equipe NÃO restaura modelo'
);

select * from finish();
rollback;
