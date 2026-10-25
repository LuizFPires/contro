-- Teste de segurança (pgTAP) da REGRA 5: a pendência só é vistoriada por quem
-- NÃO a resolveu (vistoriador ≠ resolvedor). A transição passa pela RPC
-- vistoriar_pendencia (SECURITY DEFINER), que compara contro_pessoa_atual() com
-- resolvida_por. Roda com: supabase test db
-- Requer o seed de homologação (Modelo 1 + unidades), sempre carregado pelo
-- `supabase test db` (db.seed habilitado no config.toml).

begin;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'gestor@r5.contro'),
  ('00000000-0000-0000-0000-0000000000c2', 'equipe@r5.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000c1', 'Resolvedor R5', 'gestor'),
  ('00000000-0000-0000-0000-0000000000c2', 'Vistoriador R5', 'equipe');

-- Obra de fixture (gestor gera do Modelo 1 do seed).
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select gerar_obra(
  (select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra R5',
  (select id from modelo where nome = 'Modelo 1 · CDC completo')
);

-- Pendência já em vistoria, resolvida PELO gestor (fixture via superusuário,
-- pois pendencia não tem policy de escrita direta).
set local role postgres;
insert into pendencia (obra_id, titulo, status, resolvida_por, resolvida_em)
values (
  (select id from obra where nome = 'Obra R5'),
  'Pend R5', 'em_vistoria',
  (select id from pessoa where user_id = '00000000-0000-0000-0000-0000000000c1'),
  now()
);

-- Quem RESOLVEU (gestor) NÃO pode vistoriar a própria pendência (regra 5).
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
-- Asserta a MENSAGEM específica: vistoriar_pendencia lança 42501 em três ramos
-- (não-membro, status errado, regra 5). Checar só o SQLSTATE não provaria a
-- regra 5 — por isso casamos a mensagem exata do ramo.
select throws_ok(
  $$ select vistoriar_pendencia((select id from pendencia where titulo = 'Pend R5'), true) $$,
  '42501', 'Quem resolveu não pode vistoriar a própria pendência',
  'resolvedor NÃO vistoria a própria pendência (regra 5)'
);

-- OUTRA pessoa (equipe) pode vistoriar e aprovar.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select lives_ok(
  $$ select vistoriar_pendencia((select id from pendencia where titulo = 'Pend R5'), true) $$,
  'outra pessoa vistoria e aprova'
);
select is(
  (select status from pendencia where titulo = 'Pend R5'),
  'fechada',
  'pendência fica fechada após aprovação de terceiro'
);

select * from finish();
rollback;
