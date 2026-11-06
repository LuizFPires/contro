-- Obras gerais · Etapa 4: tarefas e pendências na obra geral. Tarefa: criar,
-- editar, atribuir, excluir e restaurar = quem planeja (Coordenador,
-- Administrador); concluir, reabrir e informar avanço = qualquer participante.
-- Responsável = pessoa da obra ou Administrador, sem nome livre. Pendência:
-- tudo para qualquer participante, menos atribuir (quem planeja). Quem não
-- participa leva 42501. A Contorno continua igual.
begin;
select plan(65);

-- Elenco: K equipe Contorno, A administrador (fora de G), C coordenador de G,
-- J membro de G, X membro só de G2.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000034d1', 'k@tp.contro'),
  ('00000000-0000-0000-0000-0000000034d2', 'a@tp.contro'),
  ('00000000-0000-0000-0000-0000000034d3', 'c@tp.contro'),
  ('00000000-0000-0000-0000-0000000034d4', 'j@tp.contro'),
  ('00000000-0000-0000-0000-0000000034d5', 'x@tp.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000034d1', 'TP K', 'equipe'),
  ('00000000-0000-0000-0000-0000000034d2', 'TP A', 'gestor'),
  ('00000000-0000-0000-0000-0000000034d3', 'TP C', 'equipe'),
  ('00000000-0000-0000-0000-0000000034d4', 'TP J', 'equipe'),
  ('00000000-0000-0000-0000-0000000034d5', 'TP X', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000034d2';
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where user_id = '00000000-0000-0000-0000-0000000034d3';
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id in ('00000000-0000-0000-0000-0000000034d4', '00000000-0000-0000-0000-0000000034d5');

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000034f001', 'TP K', '2026-11-02', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000034f002', 'TP G', '2026-11-02', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000034f003', 'TP G2', '2026-11-02', 'x', 'geral');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000034f002', id from pessoa
  where user_id in ('00000000-0000-0000-0000-0000000034d3', '00000000-0000-0000-0000-0000000034d4');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000034f003', id from pessoa
  where user_id = '00000000-0000-0000-0000-0000000034d5';

insert into foto (id, obra_id, storage_path) values
  ('00000000-0000-0000-0000-00000034f301', '00000000-0000-0000-0000-00000034f002', 'g/antes.jpg'),
  ('00000000-0000-0000-0000-00000034f302', '00000000-0000-0000-0000-00000034f002', 'g/depois.jpg'),
  ('00000000-0000-0000-0000-00000034f303', '00000000-0000-0000-0000-00000034f001', 'k/antes.jpg'),
  ('00000000-0000-0000-0000-00000034f304', '00000000-0000-0000-0000-00000034f001', 'k/depois.jpg');

create temp table ids as
  select split_part(nome, ' ', 2) as quem, id from pessoa
  where user_id::text like '00000000-0000-0000-0000-0000000034d_';
grant select on ids to authenticated;

set local role authenticated;

-- C (coordenador de G) cria e edita tarefa -----------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034d3","role":"authenticated"}';
select is(
  salvar_tarefa('00000000-0000-0000-0000-00000034f401', '00000000-0000-0000-0000-00000034f002',
    'Comprar cimento', (select id from ids where quem = 'J'), '2026-11-20'),
  '00000000-0000-0000-0000-00000034f401'::uuid, 'C cria tarefa com responsável da obra');
select is(
  salvar_tarefa('00000000-0000-0000-0000-00000034f402', '00000000-0000-0000-0000-00000034f002',
    'Aprovar orçamento', (select id from ids where quem = 'A'), '2026-11-21'),
  '00000000-0000-0000-0000-00000034f402'::uuid, 'C cria tarefa com Administrador (fora da obra)');
select is(
  salvar_tarefa('00000000-0000-0000-0000-00000034f403', '00000000-0000-0000-0000-00000034f002',
    'Sem responsável', null, '2026-11-21'),
  '00000000-0000-0000-0000-00000034f403'::uuid, 'C cria tarefa sem responsável');
select throws_ok($$ select salvar_tarefa(null, '00000000-0000-0000-0000-00000034f002',
    'Fora', (select id from ids where quem = 'X'), '2026-11-20') $$,
  '22023', null, 'responsável de fora da obra → 22023');
select throws_ok($$ select salvar_tarefa(null, '00000000-0000-0000-0000-00000034f002',
    'Nome livre', null, '2026-11-20', p_responsavel_nome => 'Zé Pedreiro') $$,
  '22023', null, 'nome livre em obra geral → 22023');
select is((select count(*)::int from tarefa where obra_id = '00000000-0000-0000-0000-00000034f002'), 3,
  'só as três tarefas válidas existem');
select is(
  salvar_tarefa('00000000-0000-0000-0000-00000034f401', '00000000-0000-0000-0000-00000034f002',
    'Comprar cimento CP-II', (select id from ids where quem = 'C'), '2026-11-24', p_motivo => 'fornecedor'),
  '00000000-0000-0000-0000-00000034f401'::uuid, 'C edita e reatribui a tarefa');
select is(
  (select row(texto, prazo, prazo_original, replanejamentos, responsavel_id)::text
   from tarefa where id = '00000000-0000-0000-0000-00000034f401'),
  row('Comprar cimento CP-II', '2026-11-24'::date, '2026-11-20'::date, 1, (select id from ids where quem = 'C'))::text,
  'edição replaneja e troca o responsável');
select throws_ok($$ select salvar_tarefa('00000000-0000-0000-0000-00000034f401', '00000000-0000-0000-0000-00000034f002',
    'x', (select id from ids where quem = 'X'), '2026-11-24') $$,
  '22023', null, 'editar para responsável de fora → 22023');

-- J (membro de G): conclui, reabre e informa avanço; não cria, edita nem exclui
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034d4","role":"authenticated"}';
select throws_ok($$ select salvar_tarefa(null, '00000000-0000-0000-0000-00000034f002',
    'Membro cria', (select id from ids where quem = 'J'), '2026-11-20') $$,
  '42501', null, 'Membro não cria tarefa');
select throws_ok($$ select salvar_tarefa('00000000-0000-0000-0000-00000034f402', '00000000-0000-0000-0000-00000034f002',
    'Aprovar orçamento', (select id from ids where quem = 'J'), '2026-11-21') $$,
  '42501', null, 'Membro não atribui (edita) tarefa');
select lives_ok($$ select informar_avanco_tarefa('00000000-0000-0000-0000-00000034f402', 50, 'metade') $$,
  'Membro informa avanço');
select is((select avanco_pct::int from tarefa where id = '00000000-0000-0000-0000-00000034f402'), 50, 'avanço gravado');
select lives_ok($$ select concluir_tarefa('00000000-0000-0000-0000-00000034f402') $$, 'Membro conclui tarefa');
select is((select status from tarefa where id = '00000000-0000-0000-0000-00000034f402'), 'feita', 'tarefa feita');
select lives_ok($$ select reabrir_tarefa('00000000-0000-0000-0000-00000034f402') $$, 'Membro reabre tarefa');
select is((select status from tarefa where id = '00000000-0000-0000-0000-00000034f402'), 'aberta', 'tarefa aberta de novo');
select throws_ok($$ select excluir_tarefa('00000000-0000-0000-0000-00000034f403') $$,
  '42501', null, 'Membro não exclui tarefa');

-- C exclui e restaura; Membro não restaura
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034d3","role":"authenticated"}';
select lives_ok($$ select excluir_tarefa('00000000-0000-0000-0000-00000034f403') $$, 'C exclui tarefa');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034d4","role":"authenticated"}';
select throws_ok($$ select restaurar_tarefa('00000000-0000-0000-0000-00000034f403') $$,
  '42501', null, 'Membro não restaura tarefa');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034d3","role":"authenticated"}';
select lives_ok($$ select restaurar_tarefa('00000000-0000-0000-0000-00000034f403') $$, 'C restaura tarefa');
select is((select deleted_at from tarefa where id = '00000000-0000-0000-0000-00000034f403'), null, 'tarefa restaurada');

-- A (Administrador, fora de G) planeja: cria tarefa
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034d2","role":"authenticated"}';
select lives_ok($$ select salvar_tarefa('00000000-0000-0000-0000-00000034f404', '00000000-0000-0000-0000-00000034f002',
    'Vistoria', (select id from ids where quem = 'J'), '2026-11-25') $$, 'Administrador cria tarefa');

-- Pendências: J aponta, edita, resolve, reabre, exclui e restaura -------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034d4","role":"authenticated"}';
select is(
  apontar_pendencia('00000000-0000-0000-0000-00000034f501', '00000000-0000-0000-0000-00000034f002',
    'Fissura', 'Sala', 'alta', '00000000-0000-0000-0000-00000034f301'),
  '00000000-0000-0000-0000-00000034f501'::uuid, 'Membro aponta pendência com foto');
select lives_ok($$ select editar_pendencia('00000000-0000-0000-0000-00000034f501', 'Fissura na parede', 'Sala', 'media') $$,
  'Membro edita pendência');
select throws_ok($$ select atribuir_pendencia('00000000-0000-0000-0000-00000034f501', (select id from ids where quem = 'J')) $$,
  '42501', null, 'Membro não atribui pendência');
select lives_ok($$ select resolver_pendencia('00000000-0000-0000-0000-00000034f501', '00000000-0000-0000-0000-00000034f302') $$,
  'Membro resolve com a foto do depois');
select is((select status from pendencia where id = '00000000-0000-0000-0000-00000034f501'), 'fechada', 'pendência resolvida');
select lives_ok($$ select reabrir_pendencia('00000000-0000-0000-0000-00000034f501', false) $$, 'Membro reabre pendência');
select is((select status from pendencia where id = '00000000-0000-0000-0000-00000034f501'), 'aberta', 'pendência aberta de novo');
select lives_ok($$ select excluir_pendencia('00000000-0000-0000-0000-00000034f501') $$, 'Membro exclui pendência');
select lives_ok($$ select restaurar_pendencia('00000000-0000-0000-0000-00000034f501') $$, 'Membro restaura pendência');

-- C atribui pendência: responsável da obra ou Administrador
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034d3","role":"authenticated"}';
select lives_ok($$ select atribuir_pendencia('00000000-0000-0000-0000-00000034f501', (select id from ids where quem = 'J')) $$,
  'C atribui pendência a quem participa');
select lives_ok($$ select atribuir_pendencia('00000000-0000-0000-0000-00000034f501', (select id from ids where quem = 'A')) $$,
  'C atribui pendência ao Administrador');
select throws_ok($$ select atribuir_pendencia('00000000-0000-0000-0000-00000034f501', (select id from ids where quem = 'X')) $$,
  '22023', null, 'pendência para responsável de fora → 22023');
select is((select responsavel_id from pendencia where id = '00000000-0000-0000-0000-00000034f501'),
  (select id from ids where quem = 'A'), 'responsável da pendência é o Administrador');

-- X (membro só de G2): sem acesso às tarefas e pendências de G
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034d5","role":"authenticated"}';
select throws_ok($$ select concluir_tarefa('00000000-0000-0000-0000-00000034f401') $$,
  '42501', null, 'membro de outra obra não conclui tarefa');
select throws_ok($$ select resolver_pendencia('00000000-0000-0000-0000-00000034f501', '00000000-0000-0000-0000-00000034f302') $$,
  '42501', null, 'membro de outra obra não resolve pendência');

-- K (membro só da Contorno): 42501 em tudo da obra geral ---------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000034d1","role":"authenticated"}';
select throws_ok($$ select salvar_tarefa(null, '00000000-0000-0000-0000-00000034f002', 'K cria', null, '2026-11-20') $$,
  '42501', null, 'Contorno: não cria tarefa em G');
select throws_ok($$ select salvar_tarefa('00000000-0000-0000-0000-00000034f401', '00000000-0000-0000-0000-00000034f001', 'K edita', null, '2026-11-20') $$,
  '42501', null, 'Contorno: não edita tarefa de G (nem dizendo que é da Contorno)');
select throws_ok($$ select concluir_tarefa('00000000-0000-0000-0000-00000034f401') $$,
  '42501', null, 'Contorno: não conclui tarefa de G');
select throws_ok($$ select reabrir_tarefa('00000000-0000-0000-0000-00000034f401') $$,
  '42501', null, 'Contorno: não reabre tarefa de G');
select throws_ok($$ select informar_avanco_tarefa('00000000-0000-0000-0000-00000034f401', 25) $$,
  '42501', null, 'Contorno: não informa avanço em G');
select throws_ok($$ select excluir_tarefa('00000000-0000-0000-0000-00000034f401') $$,
  '42501', null, 'Contorno: não exclui tarefa de G');
select throws_ok($$ select restaurar_tarefa('00000000-0000-0000-0000-00000034f401') $$,
  '42501', null, 'Contorno: não restaura tarefa de G');
select throws_ok($$ select apontar_pendencia(gen_random_uuid(), '00000000-0000-0000-0000-00000034f002',
    'K aponta', null, 'alta', '00000000-0000-0000-0000-00000034f301') $$,
  '42501', null, 'Contorno: não aponta pendência em G');
select throws_ok($$ select editar_pendencia('00000000-0000-0000-0000-00000034f501', 'x', null, 'alta') $$,
  '42501', null, 'Contorno: não edita pendência de G');
select throws_ok($$ select resolver_pendencia('00000000-0000-0000-0000-00000034f501', '00000000-0000-0000-0000-00000034f302') $$,
  '42501', null, 'Contorno: não resolve pendência de G');
select throws_ok($$ select reabrir_pendencia('00000000-0000-0000-0000-00000034f501', false) $$,
  '42501', null, 'Contorno: não reabre pendência de G');
select throws_ok($$ select excluir_pendencia('00000000-0000-0000-0000-00000034f501') $$,
  '42501', null, 'Contorno: não exclui pendência de G');
select throws_ok($$ select restaurar_pendencia('00000000-0000-0000-0000-00000034f501') $$,
  '42501', null, 'Contorno: não restaura pendência de G');
select throws_ok($$ select atribuir_pendencia('00000000-0000-0000-0000-00000034f501', (select id from ids where quem = 'J')) $$,
  '42501', null, 'Contorno: não atribui pendência de G');

-- A Contorno continua igual: nome livre, atribuição a qualquer pessoa ativa ---
select is(
  salvar_tarefa('00000000-0000-0000-0000-00000034f411', '00000000-0000-0000-0000-00000034f001',
    'Chamar eletricista', null, '2026-11-20', p_responsavel_nome => 'Zé Pedreiro'),
  '00000000-0000-0000-0000-00000034f411'::uuid, 'Contorno: membro cria tarefa com nome livre');
select is((select responsavel_nome from tarefa where id = '00000000-0000-0000-0000-00000034f411'), 'Zé Pedreiro',
  'Contorno: nome livre gravado');
select is(
  salvar_tarefa('00000000-0000-0000-0000-00000034f412', '00000000-0000-0000-0000-00000034f001',
    'Conferir quadro', (select id from ids where quem = 'K'), '2026-11-20'),
  '00000000-0000-0000-0000-00000034f412'::uuid, 'Contorno: membro cria tarefa com responsável');
select lives_ok($$ select concluir_tarefa('00000000-0000-0000-0000-00000034f411') $$, 'Contorno: membro conclui');
select lives_ok($$ select excluir_tarefa('00000000-0000-0000-0000-00000034f411') $$, 'Contorno: membro exclui');
select lives_ok($$ select restaurar_tarefa('00000000-0000-0000-0000-00000034f411') $$, 'Contorno: membro restaura');
select is(
  apontar_pendencia('00000000-0000-0000-0000-00000034f511', '00000000-0000-0000-0000-00000034f001',
    'Infiltração', 'Banheiro', 'alta', '00000000-0000-0000-0000-00000034f303'),
  '00000000-0000-0000-0000-00000034f511'::uuid, 'Contorno: membro aponta pendência');
select lives_ok($$ select atribuir_pendencia('00000000-0000-0000-0000-00000034f511', (select id from ids where quem = 'X')) $$,
  'Contorno: membro atribui pendência a qualquer pessoa ativa, como hoje');
select lives_ok($$ select resolver_pendencia('00000000-0000-0000-0000-00000034f511', '00000000-0000-0000-0000-00000034f304') $$,
  'Contorno: membro resolve pendência');

-- Avisos de tarefa atribuída ----------------------------------------------------
reset role;
-- Tarefa de G com responsável de fora gravada direto (sem a RPC): não avisa.
insert into tarefa (id, obra_id, texto, responsavel_id, prazo)
  values ('00000000-0000-0000-0000-00000034f421', '00000000-0000-0000-0000-00000034f002', 'Direto',
          (select id from ids where quem = 'X'), '2026-11-20');
select is(
  (select array_agg(row(a.corpo, a.url)::text order by a.corpo) from aviso_disparo a
   where a.tipo = 'atribuicao' and a.user_id = '00000000-0000-0000-0000-0000000034d4'),
  array[row('Comprar cimento · TP G · Prazo: 20/11/2026', '/?ir=geral-hoje')::text,
        row('Vistoria · TP G · Prazo: 25/11/2026', '/?ir=geral-hoje')::text],
  'obra geral: participante avisado com o Hoje de Obras gerais');
select is(
  (select url from aviso_disparo where tipo = 'atribuicao' and user_id = '00000000-0000-0000-0000-0000000034d2'),
  '/?ir=geral-hoje', 'obra geral: Administrador avisado');
select is(
  (select count(*)::int from aviso_disparo where tipo = 'atribuicao' and user_id = '00000000-0000-0000-0000-0000000034d5'),
  0, 'obra geral: responsável de fora não é avisado');
select is(
  (select url from aviso_disparo where tipo = 'atribuicao' and user_id = '00000000-0000-0000-0000-0000000034d1'),
  '/?ir=minhas', 'Contorno: aviso igual a hoje');

select * from finish();
rollback;
