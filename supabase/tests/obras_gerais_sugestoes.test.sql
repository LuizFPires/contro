-- Obras gerais · Etapa 5: sugestões por ambiente. O mesmo nome coexiste na
-- Contorno e em Obras gerais; quem é só da Contorno não lê as de Obras gerais
-- e vice-versa; tarefa de obra geral aceita nome livre (vira sugestão geral);
-- prestador da obra geral padroniza e grava nas sugestões gerais; excluir
-- sugestão geral = quem planeja alguma obra geral. A Contorno continua igual.
begin;
select plan(33);

-- Elenco: K equipe Contorno, A administrador (Contorno também), C coordenador
-- de G, J membro de G.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000054d1', 'k@sug.contro'),
  ('00000000-0000-0000-0000-0000000054d2', 'a@sug.contro'),
  ('00000000-0000-0000-0000-0000000054d3', 'c@sug.contro'),
  ('00000000-0000-0000-0000-0000000054d4', 'j@sug.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000054d1', 'SG K', 'equipe'),
  ('00000000-0000-0000-0000-0000000054d2', 'SG A', 'gestor'),
  ('00000000-0000-0000-0000-0000000054d3', 'SG C', 'equipe'),
  ('00000000-0000-0000-0000-0000000054d4', 'SG J', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000054d2';
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where user_id = '00000000-0000-0000-0000-0000000054d3';
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id = '00000000-0000-0000-0000-0000000054d4';

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000054f001', 'SG K', '2026-11-02', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000054f002', 'SG G', '2026-11-02', 'x', 'geral');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000054f002', id from pessoa
  where user_id in ('00000000-0000-0000-0000-0000000054d3', '00000000-0000-0000-0000-0000000054d4');

insert into obra_fase (id, obra_id, ordem, titulo) values
  ('00000000-0000-0000-0000-00000054f101', '00000000-0000-0000-0000-00000054f001', 1, 'Fase K'),
  ('00000000-0000-0000-0000-00000054f102', '00000000-0000-0000-0000-00000054f002', 1, 'Fase G');
insert into obra_atividade (id, obra_id, fase_id, ordem, nome) values
  ('00000000-0000-0000-0000-00000054f201', '00000000-0000-0000-0000-00000054f001', '00000000-0000-0000-0000-00000054f101', 1, 'Atividade K'),
  ('00000000-0000-0000-0000-00000054f202', '00000000-0000-0000-0000-00000054f002', '00000000-0000-0000-0000-00000054f102', 1, 'Atividade G');

-- Mesma grafia-chave nos dois ambientes, cada uma com sua escrita.
insert into sugestao (ambiente, tipo, texto) values
  ('contorno', 'prestador', 'ELETRICA BETA SG'),
  ('geral', 'prestador', 'Elétrica Beta SG');

-- Estrutura -------------------------------------------------------------------
select col_default_is('public', 'sugestao', 'ambiente', 'contorno'::text, 'ambiente nasce contorno');
select col_not_null('public', 'sugestao', 'ambiente', 'ambiente obrigatório');
select throws_ok($$ insert into sugestao (ambiente, tipo, texto) values ('outro', 'local', 'x') $$,
  '23514', null, 'ambiente fora da lista é recusado');
select lives_ok($$ insert into sugestao (ambiente, tipo, texto) values
    ('contorno', 'local', 'Depósito SG'), ('geral', 'local', 'Depósito SG') $$,
  'mesmo nome coexiste nos dois ambientes');
select throws_ok($$ insert into sugestao (ambiente, tipo, texto) values ('geral', 'local', 'Depósito SG') $$,
  '23505', null, 'repetido no mesmo ambiente é recusado');

create temp table ids as
  select split_part(nome, ' ', 2) as quem, id from pessoa
  where user_id::text like '00000000-0000-0000-0000-0000000054d_';
grant select on ids to authenticated;

set local role authenticated;

-- K (só Contorno) --------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000054d1","role":"authenticated"}';
select is((select count(*)::int from sugestao where texto like '%SG' and ambiente = 'geral'), 0,
  'K não lê sugestão geral');
select is((select array_agg(texto order by texto) from sugestao where texto like '%SG'),
  array['Depósito SG', 'ELETRICA BETA SG'], 'K lê as da Contorno');
select throws_ok($$ insert into sugestao (ambiente, tipo, texto) values ('geral', 'local', 'K geral SG') $$,
  '42501', null, 'K não grava sugestão geral');
select lives_ok($$ insert into sugestao (tipo, texto) values ('local', 'K contorno SG') $$,
  'K grava sugestão da Contorno (padrão)');
select is(
  salvar_tarefa('00000000-0000-0000-0000-00000054f401', '00000000-0000-0000-0000-00000054f001',
    'Chamar eletricista', null, '2026-11-20', p_responsavel_nome => ' Zé SG '),
  '00000000-0000-0000-0000-00000054f401'::uuid, 'Contorno: tarefa com nome livre');
update obra_atividade set prestador = ' eletrica   beta sg ' where id = '00000000-0000-0000-0000-00000054f201';
select is((select prestador from obra_atividade where id = '00000000-0000-0000-0000-00000054f201'), 'ELETRICA BETA SG',
  'Contorno: prestador padroniza pela grafia da Contorno');
select throws_ok($$ select excluir_sugestao_prestador('Elétrica Beta SG', 'geral') $$,
  '42501', null, 'K não exclui sugestão geral');

-- C (coordenador de G) ---------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000054d3","role":"authenticated"}';
select is((select count(*)::int from sugestao where texto like '%SG' and ambiente = 'contorno'), 0,
  'C não lê sugestão da Contorno');
select is((select array_agg(texto order by texto) from sugestao where texto like '%SG'),
  array['Depósito SG', 'Elétrica Beta SG'], 'C lê as gerais');
select throws_ok($$ insert into sugestao (ambiente, tipo, texto) values ('contorno', 'local', 'C contorno SG') $$,
  '42501', null, 'C não grava sugestão da Contorno');
select lives_ok($$ insert into sugestao (ambiente, tipo, texto) values ('geral', 'local', 'C geral SG') $$,
  'C grava sugestão geral');
select is(
  salvar_tarefa('00000000-0000-0000-0000-00000054f402', '00000000-0000-0000-0000-00000054f002',
    'Comprar cimento', null, '2026-11-20', p_responsavel_nome => ' Zé SG '),
  '00000000-0000-0000-0000-00000054f402'::uuid, 'obra geral: tarefa com nome livre');
select is((select row(responsavel_id, responsavel_nome)::text from tarefa where id = '00000000-0000-0000-0000-00000054f402'),
  row(null::uuid, 'Zé SG')::text, 'obra geral: nome livre gravado sem pessoa');
select is((select usos from sugestao where ambiente = 'geral' and tipo = 'pessoa' and texto = 'Zé SG'), 1,
  'nome livre vira sugestão geral');
select is(
  salvar_tarefa('00000000-0000-0000-0000-00000054f402', '00000000-0000-0000-0000-00000054f002',
    'Comprar cimento', (select id from ids where quem = 'J'), '2026-11-20'),
  '00000000-0000-0000-0000-00000054f402'::uuid, 'obra geral: troca o nome por pessoa da obra');
select is((select responsavel_nome from tarefa where id = '00000000-0000-0000-0000-00000054f402'), null,
  'escolher pessoa limpa o nome digitado');
select throws_ok($$ select salvar_tarefa(null, '00000000-0000-0000-0000-00000054f002',
    'Fora', (select id from ids where quem = 'K'), '2026-11-20') $$,
  '22023', null, 'obra geral: pessoa de fora continua recusada');
update obra_atividade set prestador = ' eletrica   beta sg ' where id = '00000000-0000-0000-0000-00000054f202';
select is((select prestador from obra_atividade where id = '00000000-0000-0000-0000-00000054f202'), 'Elétrica Beta SG',
  'obra geral: prestador padroniza pela grafia geral');
update obra_atividade set prestador = 'Hidráulica Nova SG' where id = '00000000-0000-0000-0000-00000054f202';
select is((select usos from sugestao where ambiente = 'geral' and tipo = 'prestador' and texto = 'Hidráulica Nova SG'), 1,
  'obra geral: prestador novo vira sugestão geral');
select throws_ok($$ select excluir_sugestao_prestador('Elétrica Beta SG') $$,
  '42501', null, 'C não exclui sugestão da Contorno');
select throws_ok($$ select excluir_sugestao_prestador('Elétrica Beta SG', 'outro') $$,
  '22023', null, 'ambiente inválido');

-- J (membro de G): lê, mas não exclui -----------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000054d4","role":"authenticated"}';
select ok(exists (select 1 from sugestao where ambiente = 'geral' and texto = 'Zé SG'), 'J lê sugestão geral');
select throws_ok($$ select excluir_sugestao_prestador('Elétrica Beta SG', 'geral') $$,
  '42501', null, 'J (membro) não exclui sugestão geral');

-- C exclui a geral; a da Contorno fica -----------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000054d3","role":"authenticated"}';
select lives_ok($$ select excluir_sugestao_prestador(' eletrica beta sg ', 'geral') $$, 'C exclui sugestão geral');

-- A (administrador, com Contorno): lê os dois ambientes e exclui a geral -------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000054d2","role":"authenticated"}';
select is((select count(*)::int from sugestao where texto = 'Depósito SG'), 2, 'A lê os dois ambientes');
select lives_ok($$ select excluir_sugestao_prestador('Hidráulica Nova SG', 'geral') $$, 'A exclui sugestão geral');

reset role;
select is(
  (select array_agg(row(ambiente, texto, deleted_at is not null)::text order by ambiente, texto)
   from sugestao where tipo = 'prestador' and texto like '%SG'),
  array[row('contorno', 'ELETRICA BETA SG', false)::text,
        row('geral', 'Elétrica Beta SG', true)::text,
        row('geral', 'Hidráulica Nova SG', true)::text],
  'excluir geral não toca a da Contorno');
select is(
  (select array_agg(row(ambiente, usos)::text order by ambiente) from sugestao where tipo = 'pessoa' and texto = 'Zé SG'),
  array[row('contorno', 1)::text, row('geral', 1)::text],
  'o mesmo nome livre vira uma sugestão em cada ambiente');

select * from finish();
rollback;
