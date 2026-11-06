-- Obras gerais · Etapa 5: histórico do Score por ambiente (RLS e gravação).
begin;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007a1', 'a@sdg.contro'),
  ('00000000-0000-0000-0000-0000000007a2', 'm@sdg.contro'),
  ('00000000-0000-0000-0000-0000000007a3', 'k@sdg.contro'),
  ('00000000-0000-0000-0000-0000000007a4', 'n@sdg.contro'),
  ('00000000-0000-0000-0000-0000000007a5', 'o@sdg.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000007a1', 'Sdg A', 'gestor'),
  ('00000000-0000-0000-0000-0000000007a2', 'Sdg M', 'equipe'),
  ('00000000-0000-0000-0000-0000000007a3', 'Sdg K', 'equipe'),
  ('00000000-0000-0000-0000-0000000007a4', 'Sdg N', 'equipe'),
  ('00000000-0000-0000-0000-0000000007a5', 'Sdg O', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000007a1';
update pessoa set acesso_contorno = false, papel_geral = 'membro' where user_id = '00000000-0000-0000-0000-0000000007a2';
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id in ('00000000-0000-0000-0000-0000000007a4', '00000000-0000-0000-0000-0000000007a5');

-- G1: M e N (colegas). G2: só O.
insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000007a001', 'Sdg G1', '2031-01-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000007a002', 'Sdg G2', '2031-01-01', 'x', 'geral');
insert into obra_participante (obra_id, pessoa_id)
  select o.id::uuid, p.id from pessoa p
  join (values
    ('00000000-0000-0000-0000-00000007a001', '00000000-0000-0000-0000-0000000007a2'),
    ('00000000-0000-0000-0000-00000007a001', '00000000-0000-0000-0000-0000000007a4'),
    ('00000000-0000-0000-0000-00000007a002', '00000000-0000-0000-0000-0000000007a5')
  ) as o (id, uid) on o.uid::uuid = p.user_id;

-- Histórico geral gravado como dono: colega N, pessoa O (só em G2), prestador.
insert into score_diario (ambiente, dia, aba, chave, nome, score30)
  select 'geral', current_date, 'equipe', p.id::text, p.nome, 70 from pessoa p
  where p.user_id in ('00000000-0000-0000-0000-0000000007a4', '00000000-0000-0000-0000-0000000007a5');
insert into score_diario (ambiente, dia, aba, chave, nome, score30)
  values ('geral', current_date, 'prestadores', 'eletrica silva', 'Elétrica Silva', 80);

set local role authenticated;

-- Admin (também gestor da Contorno): grava nos dois ambientes com a mesma chave.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}';
select is(gravar_score_diario('[{"aba":"equipe","chave":"nome:Ana","nome":"Ana","score30":50,"score90":60}]'::jsonb), 1, 'uma chamada com um argumento grava na Contorno');
select is(gravar_score_diario('[{"aba":"equipe","chave":"nome:Ana","nome":"Ana","score30":90,"score90":95}]'::jsonb, 'geral'), 1, 'admin grava em Obras gerais');
select is((select count(*)::int from score_diario where chave = 'nome:Ana'), 2, 'a mesma chave coexiste nos dois ambientes');
select is((select score30::int from score_diario where chave = 'nome:Ana' and ambiente = 'contorno'), 50, 'Contorno intacta');
select throws_ok($$ select gravar_score_diario('[]'::jsonb, 'outro') $$, '22023', null, 'ambiente inválido é rejeitado');

-- Admin lê tudo do geral.
select is((select count(*)::int from score_diario where ambiente = 'geral' and (nome in ('Sdg N','Sdg O','Elétrica Silva') or chave = 'nome:Ana')), 4, 'admin lê todo o histórico geral');

-- Membro de Obras gerais: lê o geral, não lê a Contorno, não grava.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007a2","role":"authenticated"}';
select is((select count(*)::int from score_diario where nome = 'Sdg N'), 1, 'membro de G lê o histórico do colega de G');
select is((select count(*)::int from score_diario where nome = 'Sdg O'), 0, 'membro não lê quem só está em outra obra');
select is((select count(*)::int from score_diario where aba = 'prestadores'), 0, 'membro não lê prestadores');
select is((select count(*)::int from score_diario where chave = 'nome:Ana'), 0, 'membro não lê nome livre');
select is((select count(*)::int from score_diario where ambiente = 'contorno'), 0, 'membro geral não lê a Contorno');
select throws_ok($$ select gravar_score_diario('[]'::jsonb, 'geral') $$, '42501', null, 'membro geral não grava');

-- Equipe só da Contorno: lê a Contorno, não lê o geral, não grava no geral.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007a3","role":"authenticated"}';
select is((select count(*)::int from score_diario where chave = 'nome:Ana' and ambiente = 'geral'), 0, 'equipe da Contorno não lê o geral');
select throws_ok($$ select gravar_score_diario('[]'::jsonb, 'geral') $$, '42501', null, 'equipe da Contorno não grava no geral');

select * from finish();
rollback;
