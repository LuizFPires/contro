-- Obras gerais · Etapa 2: as ações de campo (concluir, desfazer, anexar foto,
-- avanço, subitem, providência) abertas a quem participa da obra, inclusive o
-- Membro de obra geral, que conclui atividade de outra pessoa. Quem não
-- participa leva 42501. A Contorno continua igual.
begin;
select plan(37);

-- Elenco: K equipe Contorno, O dono de atividades em G (membro), J membro de G,
-- X membro só de G2 (outra obra geral).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000003d1', 'k@campo.contro'),
  ('00000000-0000-0000-0000-0000000003d2', 'o@campo.contro'),
  ('00000000-0000-0000-0000-0000000003d3', 'j@campo.contro'),
  ('00000000-0000-0000-0000-0000000003d4', 'x@campo.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000003d1', 'Campo K', 'equipe'),
  ('00000000-0000-0000-0000-0000000003d2', 'Campo O', 'equipe'),
  ('00000000-0000-0000-0000-0000000003d3', 'Campo J', 'equipe'),
  ('00000000-0000-0000-0000-0000000003d4', 'Campo X', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id in ('00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003d3', '00000000-0000-0000-0000-0000000003d4');

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000003f001', 'Campo K', '2026-11-02', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000003f002', 'Campo G', '2026-11-02', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000003f003', 'Campo G2', '2026-11-02', 'x', 'geral');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000003f002', id from pessoa
  where user_id in ('00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003d3');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000003f003', id from pessoa
  where user_id = '00000000-0000-0000-0000-0000000003d4';

create temp table ids as
  select split_part(nome, ' ', 2) as quem, id from pessoa
  where user_id::text like '00000000-0000-0000-0000-0000000003d_';
grant select on ids to authenticated;

insert into obra_fase (id, obra_id, ordem, titulo) values
  ('00000000-0000-0000-0000-00000003f101', '00000000-0000-0000-0000-00000003f001', 1, 'Fase K'),
  ('00000000-0000-0000-0000-00000003f102', '00000000-0000-0000-0000-00000003f002', 1, 'Fase G');
-- Contorno: K1 conclui, K2 avanço, K3 com subitem K3 sub
insert into obra_atividade (id, obra_id, fase_id, ordem, nome) values
  ('00000000-0000-0000-0000-00000003f211', '00000000-0000-0000-0000-00000003f001', '00000000-0000-0000-0000-00000003f101', 1, 'K1'),
  ('00000000-0000-0000-0000-00000003f212', '00000000-0000-0000-0000-00000003f001', '00000000-0000-0000-0000-00000003f101', 2, 'K2'),
  ('00000000-0000-0000-0000-00000003f213', '00000000-0000-0000-0000-00000003f001', '00000000-0000-0000-0000-00000003f101', 3, 'K3');
insert into obra_atividade (id, obra_id, fase_id, pai_id, ordem, nome) values
  ('00000000-0000-0000-0000-00000003f214', '00000000-0000-0000-0000-00000003f001', '00000000-0000-0000-0000-00000003f101',
   '00000000-0000-0000-0000-00000003f213', 1, 'K3 sub');
-- Geral: G1 (de O) conclui, G2 avanço, G3 com subitem, G5 já concluída sem foto, G6 conclui com foto
insert into obra_atividade (id, obra_id, fase_id, ordem, nome, responsavel_id) values
  ('00000000-0000-0000-0000-00000003f221', '00000000-0000-0000-0000-00000003f002', '00000000-0000-0000-0000-00000003f102', 1, 'G1', (select id from ids where quem = 'O')),
  ('00000000-0000-0000-0000-00000003f222', '00000000-0000-0000-0000-00000003f002', '00000000-0000-0000-0000-00000003f102', 2, 'G2', null),
  ('00000000-0000-0000-0000-00000003f223', '00000000-0000-0000-0000-00000003f002', '00000000-0000-0000-0000-00000003f102', 3, 'G3', null),
  ('00000000-0000-0000-0000-00000003f225', '00000000-0000-0000-0000-00000003f002', '00000000-0000-0000-0000-00000003f102', 5, 'G5', null),
  ('00000000-0000-0000-0000-00000003f226', '00000000-0000-0000-0000-00000003f002', '00000000-0000-0000-0000-00000003f102', 6, 'G6', null);
insert into obra_atividade (id, obra_id, fase_id, pai_id, ordem, nome) values
  ('00000000-0000-0000-0000-00000003f224', '00000000-0000-0000-0000-00000003f002', '00000000-0000-0000-0000-00000003f102',
   '00000000-0000-0000-0000-00000003f223', 1, 'G3 sub');
update obra_atividade set concluida_em = now() where id = '00000000-0000-0000-0000-00000003f225';
insert into obra_providencia (id, obra_id, atividade_id, tipo, descricao) values
  ('00000000-0000-0000-0000-00000003f301', '00000000-0000-0000-0000-00000003f001', '00000000-0000-0000-0000-00000003f211', 'compra', 'Prov K'),
  ('00000000-0000-0000-0000-00000003f302', '00000000-0000-0000-0000-00000003f002', '00000000-0000-0000-0000-00000003f222', 'compra', 'Prov G');
insert into foto (id, obra_id, storage_path) values
  ('00000000-0000-0000-0000-00000003f401', '00000000-0000-0000-0000-00000003f002', 'g/anexo.jpg');

set local role authenticated;

-- J (membro de G) conclui atividade de outra pessoa, sem foto
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003d3","role":"authenticated"}';
select lives_ok($$ select concluir_atividade('00000000-0000-0000-0000-00000003f221', null, '00000000-0000-0000-0000-00000003f501') $$,
  'J conclui atividade de O em G');
select isnt((select concluida_em from obra_atividade where id = '00000000-0000-0000-0000-00000003f221'), null, 'G1 concluida');
select is((select por from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000003f221' and tipo = 'concluida'),
  (select id from ids where quem = 'J'), 'evento concluida: por = J');
select is((select depois ->> 'responsavel_id' from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000003f221' and tipo = 'concluida'),
  (select id::text from ids where quem = 'O'), 'evento concluida: responsavel_id = o dono (O)');
select is((select concluir_atividade('00000000-0000-0000-0000-00000003f221', null, '00000000-0000-0000-0000-00000003f501') ->> 'repetida'),
  'true', 'mesma op repetida devolve repetida');
select is((select count(*)::int from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000003f221' and tipo = 'concluida'),
  1, 'op repetida nao duplica o evento');

select lives_ok($$ select desfazer_conclusao('00000000-0000-0000-0000-00000003f221', '00000000-0000-0000-0000-00000003f502') $$, 'J desfaz em G');
select is((select concluida_em from obra_atividade where id = '00000000-0000-0000-0000-00000003f221'), null, 'G1 reaberta');

select lives_ok($$ select definir_avanco('00000000-0000-0000-0000-00000003f222', 50, '00000000-0000-0000-0000-00000003f503') $$, 'J avanca 50 em G');
select is((select avanco_pct::int from obra_atividade where id = '00000000-0000-0000-0000-00000003f222'), 50, 'avanco 50 gravado');

select lives_ok($$ select marcar_subitem('00000000-0000-0000-0000-00000003f224', true, '00000000-0000-0000-0000-00000003f504') $$, 'J marca subitem em G');
select isnt((select concluida_em from obra_atividade where id = '00000000-0000-0000-0000-00000003f224'), null, 'subitem marcado');

select lives_ok($$ select marcar_providencia('00000000-0000-0000-0000-00000003f302', true, '00000000-0000-0000-0000-00000003f505') $$, 'J marca providencia em G');
select is((select status from obra_providencia where id = '00000000-0000-0000-0000-00000003f302'), 'feito', 'providencia feita');

-- Foto de conclusão: a linha em foto é insert direto (RLS por contro_ve_obra)
select lives_ok($$ insert into foto (id, obra_id, storage_path) values
  ('00000000-0000-0000-0000-00000003f402', '00000000-0000-0000-0000-00000003f002', 'g/conclusao.jpg') $$,
  'J insere foto da obra G');
select lives_ok($$ select concluir_atividade('00000000-0000-0000-0000-00000003f226', '00000000-0000-0000-0000-00000003f402', '00000000-0000-0000-0000-00000003f506') $$,
  'J conclui G6 com foto');
select is((select foto_conclusao_id from obra_atividade where id = '00000000-0000-0000-0000-00000003f226'),
  '00000000-0000-0000-0000-00000003f402'::uuid, 'foto de conclusao gravada');
select lives_ok($$ select anexar_foto_conclusao('00000000-0000-0000-0000-00000003f225', '00000000-0000-0000-0000-00000003f401', '00000000-0000-0000-0000-00000003f507') $$,
  'J anexa foto a atividade concluida sem foto');
select is((select foto_conclusao_id from obra_atividade where id = '00000000-0000-0000-0000-00000003f225'),
  '00000000-0000-0000-0000-00000003f401'::uuid, 'foto anexada');

-- J não participa da Contorno
select throws_ok($$ select concluir_atividade('00000000-0000-0000-0000-00000003f211', null) $$, '42501', null, 'J (geral) nao conclui na Contorno');

-- X (outra obra geral) e K (só Contorno) não mexem em G: 6 ações cada
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003d4","role":"authenticated"}';
select throws_ok($$ select concluir_atividade('00000000-0000-0000-0000-00000003f222', null) $$, '42501', null, 'X nao conclui em G');
select throws_ok($$ select desfazer_conclusao('00000000-0000-0000-0000-00000003f225') $$, '42501', null, 'X nao desfaz em G');
select throws_ok($$ select anexar_foto_conclusao('00000000-0000-0000-0000-00000003f226', '00000000-0000-0000-0000-00000003f402') $$, '42501', null, 'X nao anexa foto em G');
select throws_ok($$ select definir_avanco('00000000-0000-0000-0000-00000003f222', 75) $$, '42501', null, 'X nao avanca em G');
select throws_ok($$ select marcar_subitem('00000000-0000-0000-0000-00000003f224', false) $$, '42501', null, 'X nao marca subitem em G');
select throws_ok($$ select marcar_providencia('00000000-0000-0000-0000-00000003f302', false) $$, '42501', null, 'X nao marca providencia em G');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003d1","role":"authenticated"}';
select throws_ok($$ select concluir_atividade('00000000-0000-0000-0000-00000003f222', null) $$, '42501', null, 'K nao conclui em G');
select throws_ok($$ select desfazer_conclusao('00000000-0000-0000-0000-00000003f225') $$, '42501', null, 'K nao desfaz em G');
select throws_ok($$ select anexar_foto_conclusao('00000000-0000-0000-0000-00000003f226', '00000000-0000-0000-0000-00000003f402') $$, '42501', null, 'K nao anexa foto em G');
select throws_ok($$ select definir_avanco('00000000-0000-0000-0000-00000003f222', 75) $$, '42501', null, 'K nao avanca em G');
select throws_ok($$ select marcar_subitem('00000000-0000-0000-0000-00000003f224', false) $$, '42501', null, 'K nao marca subitem em G');
select throws_ok($$ select marcar_providencia('00000000-0000-0000-0000-00000003f302', false) $$, '42501', null, 'K nao marca providencia em G');

-- K na Contorno: tudo como antes
select lives_ok($$ select concluir_atividade('00000000-0000-0000-0000-00000003f211', null) $$, 'K conclui na Contorno');
select lives_ok($$ select desfazer_conclusao('00000000-0000-0000-0000-00000003f211') $$, 'K desfaz na Contorno');
select lives_ok($$ select definir_avanco('00000000-0000-0000-0000-00000003f212', 25) $$, 'K avanca na Contorno');
select lives_ok($$ select marcar_subitem('00000000-0000-0000-0000-00000003f214', true) $$, 'K marca subitem na Contorno');
select lives_ok($$ select marcar_providencia('00000000-0000-0000-0000-00000003f301', true) $$, 'K marca providencia na Contorno');

select * from finish();
rollback;
