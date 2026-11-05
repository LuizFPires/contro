-- Score diário (pgTAP): RLS, gravação do dia pelo servidor e bloqueio de quem não é membro.

begin;
select plan(9);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.score_diario'::regclass),
  'RLS em score_diario'
);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'equipe@scorediario.contro'),
  ('00000000-0000-0000-0000-0000000000e2', 'fora@scorediario.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000e1', 'Equipe Score Diário', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

-- Linha de um dia passado (como owner): não pode mudar pela função.
insert into score_diario (dia, aba, chave, nome, score30, score90)
  values ('2026-01-05', 'equipe', 'nome:Thainá', 'Thainá', 71, 80);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

select is(
  gravar_score_diario('[{"aba":"equipe","chave":"nome:Thainá","nome":"Thainá","score30":61,"score90":72},
                        {"aba":"prestadores","chave":"eletrica silva","nome":"Elétrica Silva","score30":null,"score90":88}]'::jsonb),
  2,
  'membro grava as linhas de hoje'
);
select is(
  (select score30::int from score_diario where chave = 'nome:Thainá' and dia = (now() at time zone 'America/Sao_Paulo')::date),
  61,
  'o dia é o de hoje no fuso de São Paulo'
);
select is(
  (select score30::int from score_diario where chave = 'nome:Thainá' and dia = '2026-01-05'),
  71,
  'dia passado não muda'
);

select gravar_score_diario('[{"aba":"equipe","chave":"nome:Thainá","nome":"Thainá","score30":58,"score90":70}]'::jsonb);
select is(
  (select score30::int from score_diario where chave = 'nome:Thainá' and dia = (now() at time zone 'America/Sao_Paulo')::date),
  58,
  'a última gravação do dia vence'
);

select is((select count(*)::int from score_diario), 3, 'membro lê o histórico');

select throws_ok(
  $$ insert into score_diario (dia, aba, chave, nome) values ('2026-01-06', 'equipe', 'x', 'x') $$,
  '42501',
  null,
  'escrita direta é bloqueada'
);

select throws_ok(
  $$ select gravar_score_diario('[{"aba":"equipe","chave":"x","nome":"x","score30":120}]'::jsonb) $$,
  '23514',
  null,
  'score fora de 0 a 100 é rejeitado'
);

-- Quem não é membro não grava.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select throws_ok(
  $$ select gravar_score_diario('[]'::jsonb) $$,
  '42501',
  null,
  'não membro não grava'
);

select * from finish();
rollback;
