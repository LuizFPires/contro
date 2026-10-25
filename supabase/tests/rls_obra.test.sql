-- Teste de política (pgTAP) das obras. Roda com: supabase test db
-- Invariantes de segurança do M2+:
--   - dados da obra são visíveis só a membro ativo (não-membro não vê nada);
--   - tabelas obra_* aceitam escrita de membro (campo edita direto);
--   - pendencia e tarefa NÃO têm policy de escrita: só mudam via RPC
--     (SECURITY DEFINER), nunca por INSERT/UPDATE direto do cliente.
-- Requer o seed de homologação aplicado (Modelo 1 + unidades Contorno), que o
-- `supabase test db` sempre carrega (db.seed habilitado no config.toml).

begin;
select plan(11);

select ok((select relrowsecurity from pg_class where oid = 'public.obra'::regclass), 'RLS em obra');
select ok((select relrowsecurity from pg_class where oid = 'public.obra_atividade'::regclass), 'RLS em obra_atividade');
select ok((select relrowsecurity from pg_class where oid = 'public.pendencia'::regclass), 'RLS em pendencia');
select ok((select relrowsecurity from pg_class where oid = 'public.tarefa'::regclass), 'RLS em tarefa');

-- Membros (gestor, equipe) e um autenticado SEM pessoa (não-membro).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'gestor@obra.contro'),
  ('00000000-0000-0000-0000-0000000000b2', 'equipe@obra.contro'),
  ('00000000-0000-0000-0000-0000000000b3', 'avulso@obra.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000b1', 'Gestor Obra', 'gestor'),
  ('00000000-0000-0000-0000-0000000000b2', 'Equipe Obra', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;

-- GESTOR cria uma obra a partir do Modelo 1 do seed (gera atividades).
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select lives_ok(
  $$ select gerar_obra(
       (select id from unidade where nome like 'Contorno%' order by nome limit 1),
       '2026-11-02',
       'Obra RLS',
       (select id from modelo where nome = 'Modelo 1 · CDC completo')
     ) $$,
  'gestor gera obra do Modelo 1'
);

-- EQUIPE (membro) enxerga a obra e suas atividades.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select is(
  (select count(*)::int from obra where nome = 'Obra RLS'),
  1,
  'equipe (membro) enxerga a obra'
);
select ok(
  (select count(*) > 0 from obra_atividade oa join obra o on o.id = oa.obra_id where o.nome = 'Obra RLS'),
  'equipe enxerga as atividades da obra'
);

-- Lado positivo do invariante: membro escreve direto em obra_* (o campo edita
-- prestador/duração/predecessoras sem RPC). Guarda contra remover a policy *_upd.
select lives_ok(
  $$ update obra_atividade set prestador = 'Prestador Teste'
     where obra_id = (select id from obra where nome = 'Obra RLS') $$,
  'membro (equipe) escreve direto em obra_atividade'
);

-- EQUIPE não escreve em pendencia/tarefa direto: só via RPC (sem policy -> 42501).
select throws_ok(
  $$ insert into pendencia (obra_id, titulo) values
       ((select id from obra where nome = 'Obra RLS'), 'Hack') $$,
  '42501', null,
  'escrita direta em pendencia é bloqueada (só via RPC)'
);
select throws_ok(
  $$ insert into tarefa (obra_id, texto, prazo) values
       ((select id from obra where nome = 'Obra RLS'), 'Hack', current_date) $$,
  '42501', null,
  'escrita direta em tarefa é bloqueada (só via RPC)'
);

-- NÃO-MEMBRO não enxerga obra nem atividades.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}';
select is(
  (select count(*)::int from obra),
  0,
  'não-membro NÃO enxerga obras'
);

select * from finish();
rollback;
