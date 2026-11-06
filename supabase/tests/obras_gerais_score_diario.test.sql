-- Obras gerais · Etapa 5: histórico do Score por ambiente (RLS e gravação).
begin;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007a1', 'a@sdg.contro'),
  ('00000000-0000-0000-0000-0000000007a2', 'm@sdg.contro'),
  ('00000000-0000-0000-0000-0000000007a3', 'k@sdg.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000007a1', 'Sdg A', 'gestor'),
  ('00000000-0000-0000-0000-0000000007a2', 'Sdg M', 'equipe'),
  ('00000000-0000-0000-0000-0000000007a3', 'Sdg K', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000007a1';
update pessoa set acesso_contorno = false, papel_geral = 'membro' where user_id = '00000000-0000-0000-0000-0000000007a2';

set local role authenticated;

-- Admin (também gestor da Contorno): grava nos dois ambientes com a mesma chave.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}';
select is(gravar_score_diario('[{"aba":"equipe","chave":"nome:Ana","nome":"Ana","score30":50,"score90":60}]'::jsonb), 1, 'uma chamada com um argumento grava na Contorno');
select is(gravar_score_diario('[{"aba":"equipe","chave":"nome:Ana","nome":"Ana","score30":90,"score90":95}]'::jsonb, 'geral'), 1, 'admin grava em Obras gerais');
select is((select count(*)::int from score_diario where chave = 'nome:Ana'), 2, 'a mesma chave coexiste nos dois ambientes');
select is((select score30::int from score_diario where chave = 'nome:Ana' and ambiente = 'contorno'), 50, 'Contorno intacta');
select throws_ok($$ select gravar_score_diario('[]'::jsonb, 'outro') $$, '22023', null, 'ambiente inválido é rejeitado');

-- Membro de Obras gerais: lê o geral, não lê a Contorno, não grava.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007a2","role":"authenticated"}';
select is((select score30::int from score_diario where chave = 'nome:Ana'), 90, 'membro geral lê só o histórico geral');
select is((select count(*)::int from score_diario where ambiente = 'contorno'), 0, 'membro geral não lê a Contorno');
select throws_ok($$ select gravar_score_diario('[]'::jsonb, 'geral') $$, '42501', null, 'membro geral não grava');

-- Equipe só da Contorno: lê a Contorno, não lê o geral, não grava no geral.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007a3","role":"authenticated"}';
select is((select count(*)::int from score_diario where chave = 'nome:Ana' and ambiente = 'geral'), 0, 'equipe da Contorno não lê o geral');
select throws_ok($$ select gravar_score_diario('[]'::jsonb, 'geral') $$, '42501', null, 'equipe da Contorno não grava no geral');

select * from finish();
rollback;
