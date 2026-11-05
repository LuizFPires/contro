-- Obras gerais: leitura e escrita de cada obra só para quem participa dela
-- (tabelas da obra, eventos, Storage de fotos, pessoa e guarda nas RPCs).
begin;
select plan(53);

-- Elenco (mesmo da Task 2, outros uuids): M equipe Contorno, A administrador,
-- C coordenador de G1, J membro de G1, X sem pessoa.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'm@rls.contro'),
  ('00000000-0000-0000-0000-0000000000d2', 'a@rls.contro'),
  ('00000000-0000-0000-0000-0000000000d3', 'c@rls.contro'),
  ('00000000-0000-0000-0000-0000000000d4', 'j@rls.contro'),
  ('00000000-0000-0000-0000-0000000000d5', 'x@rls.contro'),
  ('00000000-0000-0000-0000-0000000000d6', 'g@rls.contro'),
  ('00000000-0000-0000-0000-0000000000d7', 'n@rls.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000d1', 'RLS M', 'equipe'),
  ('00000000-0000-0000-0000-0000000000d2', 'RLS A', 'gestor'),
  ('00000000-0000-0000-0000-0000000000d3', 'RLS C', 'equipe'),
  ('00000000-0000-0000-0000-0000000000d4', 'RLS J', 'equipe'),
  ('00000000-0000-0000-0000-0000000000d6', 'RLS G', 'gestor'),
  ('00000000-0000-0000-0000-0000000000d7', 'RLS N', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000000d2';
update pessoa set acesso_contorno = false, papel_geral = 'coordenador' where user_id = '00000000-0000-0000-0000-0000000000d3';
update pessoa set acesso_contorno = false, papel_geral = 'membro' where user_id = '00000000-0000-0000-0000-0000000000d4';
-- N: membro de obras gerais sem nenhuma obra.
update pessoa set acesso_contorno = false, papel_geral = 'membro' where user_id = '00000000-0000-0000-0000-0000000000d7';

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000000f001', 'RLS K', '2026-11-02', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000000f002', 'RLS G1', '2026-11-02', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000000f003', 'RLS G2', '2026-11-02', 'x', 'geral');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000000f002', id from pessoa
  where user_id in ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000d4');

insert into obra_fase (id, obra_id, ordem, titulo) values
  ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f001', 1, 'Fase K'),
  ('00000000-0000-0000-0000-00000000f102', '00000000-0000-0000-0000-00000000f002', 1, 'Fase G1');
insert into obra_atividade (id, obra_id, fase_id, ordem, nome) values
  ('00000000-0000-0000-0000-00000000f201', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f101', 1, 'Atividade K'),
  ('00000000-0000-0000-0000-00000000f202', '00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f102', 1, 'Atividade G1');
insert into obra_atividade_evento (atividade_id, tipo) values
  ('00000000-0000-0000-0000-00000000f202', 'teste');
insert into tarefa (id, obra_id, texto, prazo) values
  ('00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000f001', 'Tarefa K', '2026-11-10'),
  ('00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-00000000f002', 'Tarefa G1', '2026-11-10');
insert into foto (id, obra_id, storage_path) values
  ('00000000-0000-0000-0000-00000000f401', '00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f002/a.jpg');
insert into storage.objects (bucket_id, name) values
  ('fotos', '00000000-0000-0000-0000-00000000f001/k.jpg'),
  ('fotos', '00000000-0000-0000-0000-00000000f002/a.jpg'),
  ('fotos', 'nao-e-uuid/x.jpg');

-- Reunião com K e G1 na pauta e uma resposta de item de G1.
insert into reuniao (id, data) values ('00000000-0000-0000-0000-00000000f501', '2026-11-16');
insert into reuniao_obra (reuniao_id, obra_id) values
  ('00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000f001'),
  ('00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000f002');
insert into reuniao_resposta (reuniao_id, obra_id, secao, item_id, resposta) values
  ('00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000f002', 'cobranca',
   '00000000-0000-0000-0000-00000000f302', 'feita');

set local role authenticated;

-- M (equipe Contorno): vê K, nada de G1, não escreve em G1
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is((select count(*)::int from obra_fase where obra_id = '00000000-0000-0000-0000-00000000f002'), 0, 'M nao ve fase de G1');
select is((select count(*)::int from obra_fase where obra_id = '00000000-0000-0000-0000-00000000f001'), 1, 'M ve fase de K');
select is((select count(*)::int from obra where id in ('00000000-0000-0000-0000-00000000f001','00000000-0000-0000-0000-00000000f002','00000000-0000-0000-0000-00000000f003')), 1, 'M ve so K entre K, G1, G2');
select is((select count(*)::int from obra_atividade where obra_id = '00000000-0000-0000-0000-00000000f002'), 0, 'M nao ve atividade de G1');
select is((select count(*)::int from tarefa where obra_id = '00000000-0000-0000-0000-00000000f002'), 0, 'M nao ve tarefa de G1');
select is((select count(*)::int from tarefa where obra_id = '00000000-0000-0000-0000-00000000f001'), 1, 'M ve tarefa de K');
select is((select count(*)::int from foto where obra_id = '00000000-0000-0000-0000-00000000f002'), 0, 'M nao ve foto de G1');
select is((select count(*)::int from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000000f202'), 0, 'M nao ve evento de atividade de G1');
select throws_ok(
  $$ select public.concluir_atividade('00000000-0000-0000-0000-00000000f202', null, null) $$,
  '42501', 'sem acesso a esta obra', 'M nao conclui atividade de G1 pela RPC (guarda)');
select throws_ok(
  $$ insert into obra_fase (obra_id, ordem, titulo) values ('00000000-0000-0000-0000-00000000f002', 9, 'Intrusa') $$,
  '42501', null, 'M nao insere fase em G1');
select throws_ok(
  $$ insert into obra (nome, inicio, modelo_rotulo, ambiente) values ('Geral direta', '2026-11-02', 'x', 'geral') $$,
  '42501', null, 'M nao cria obra geral direto');
select lives_ok(
  $$ insert into obra (nome, inicio, modelo_rotulo) values ('Contorno direta', '2026-11-02', 'x') $$,
  'M ainda cria obra Contorno direto');
select throws_ok(
  $$ update obra set ambiente = 'geral' where id = '00000000-0000-0000-0000-00000000f001' $$,
  '42501', null, 'M nao muda o ambiente de K');
select lives_ok(
  $$ update obra_atividade set prestador = 'Prestador K' where id = '00000000-0000-0000-0000-00000000f201' $$,
  'M ainda escreve direto em atividade de K');
select lives_ok($$ select public.abrir_reuniao('2026-11-09') $$, 'M abre a reuniao com obra geral ativa');
select throws_ok(
  $$ insert into obra_dependencia (obra_id, atividade_id, predecessora_id) values
     ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f201', '00000000-0000-0000-0000-00000000f202') $$,
  '42501', 'item de outra obra (predecessora_id)', 'M nao liga atividade de K a predecessora de G1');
select throws_ok(
  $$ select public.responder_reuniao('00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000f001',
       'cobranca', '00000000-0000-0000-0000-00000000f302', null) $$,
  '42501', 'sem acesso a esta obra', 'M nao apaga resposta de G1 pela RPC (guarda no delete)');
select throws_ok(
  $$ update obra_atividade set obra_id = '00000000-0000-0000-0000-00000000f002' where id = '00000000-0000-0000-0000-00000000f201' $$,
  '42501', null, 'M nao move atividade de K para G1');
select is((select count(*)::int from storage.objects where bucket_id = 'fotos' and name like '00000000-0000-0000-0000-00000000f002/%'), 0, 'M nao ve objeto de foto de G1');
select is((select count(*)::int from storage.objects where bucket_id = 'fotos' and name like '00000000-0000-0000-0000-00000000f001/%'), 1, 'M ve objeto de foto de K');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('fotos', '00000000-0000-0000-0000-00000000f002/m.jpg') $$,
  '42501', null, 'M nao envia foto para G1');

-- C (coordenador de G1): vê G1, nada de K
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}';
select is((select count(*)::int from obra_fase where obra_id = '00000000-0000-0000-0000-00000000f002'), 1, 'C ve fase de G1');
select is((select count(*)::int from obra_atividade where obra_id = '00000000-0000-0000-0000-00000000f002'), 1, 'C ve atividade de G1');
select is((select count(*)::int from obra_atividade_evento where atividade_id = '00000000-0000-0000-0000-00000000f202'), 1, 'C ve evento de atividade de G1');
select is((select count(*)::int from obra where id = '00000000-0000-0000-0000-00000000f001'), 0, 'C nao ve obra K');
select is((select count(*)::int from obra_fase where obra_id = '00000000-0000-0000-0000-00000000f001'), 0, 'C nao ve fase de K');
select is((select count(*)::int from obra_atividade where obra_id = '00000000-0000-0000-0000-00000000f001'), 0, 'C nao ve atividade de K');
select is((select count(*)::int from tarefa where obra_id = '00000000-0000-0000-0000-00000000f001'), 0, 'C nao ve tarefa de K');
select is((select count(*)::int from tarefa where obra_id = '00000000-0000-0000-0000-00000000f002'), 1, 'C ve tarefa de G1');
select is((select count(*)::int from obra where id = '00000000-0000-0000-0000-00000000f003'), 0, 'C nao ve G2');
select lives_ok(
  $$ insert into obra_fase (obra_id, ordem, titulo) values ('00000000-0000-0000-0000-00000000f002', 2, 'Fase G1 b') $$,
  'C insere fase em G1');
select throws_ok(
  $$ insert into obra_fase (obra_id, ordem, titulo) values ('00000000-0000-0000-0000-00000000f001', 9, 'Intrusa') $$,
  '42501', null, 'C nao insere fase em K');
select lives_ok(
  $$ insert into obra_atividade (obra_id, fase_id, ordem, nome) values
     ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f102', 2, 'Atividade G1 b') $$,
  'C insere atividade em fase de G1');
select throws_ok(
  $$ insert into obra_atividade (obra_id, fase_id, ordem, nome, pai_id) values
     ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f102', 3, 'Subitem intruso',
      '00000000-0000-0000-0000-00000000f201') $$,
  '42501', 'item de outra obra (pai_id)', 'C nao pendura subitem de G1 em atividade de K');
select throws_ok(
  $$ insert into obra_providencia (obra_id, atividade_id, tipo, descricao) values
     ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f201', 'compra', 'Intrusa') $$,
  '42501', 'item de outra obra (atividade_id)', 'C nao pendura providencia de G1 em atividade de K');
select is((select count(*)::int from storage.objects where bucket_id = 'fotos' and name like '00000000-0000-0000-0000-00000000f002/%'), 1, 'C ve objeto de foto de G1');
select is((select count(*)::int from storage.objects where bucket_id = 'fotos'), 1, 'C le o bucket sem erro com pasta que nao e uuid');
select is((select count(*)::int from pessoa where user_id = '00000000-0000-0000-0000-0000000000d3'), 1, 'C ve a propria pessoa');
select is((select count(*)::int from pessoa where user_id = '00000000-0000-0000-0000-0000000000d4'), 1, 'C ve outro participante de G1');
select is((select count(*)::int from pessoa where user_id = '00000000-0000-0000-0000-0000000000d1'), 0, 'C nao ve M');

-- A (administrador): vê K e G1
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select is((select count(*)::int from obra where id in ('00000000-0000-0000-0000-00000000f001','00000000-0000-0000-0000-00000000f002')), 2, 'A ve K e G1');
select is((select count(*)::int from obra_fase where obra_id in ('00000000-0000-0000-0000-00000000f001','00000000-0000-0000-0000-00000000f002')), 3, 'A ve fases de K e G1');
select is((select count(*)::int from pessoa where user_id in ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000d3')), 2, 'A ve M e C');

-- J (membro de G1): vê G1
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}';
select is((select count(*)::int from obra where id = '00000000-0000-0000-0000-00000000f002'), 1, 'J ve G1');
select is((select count(*)::int from pessoa where user_id = '00000000-0000-0000-0000-0000000000d3'), 1, 'J ve C');

-- G (gestor Contorno, nao administrador): RPC que mexe na obra
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d6","role":"authenticated"}';
select throws_ok(
  $$ select public.excluir_obra('00000000-0000-0000-0000-00000000f002') $$,
  '42501', 'sem acesso a esta obra', 'G nao apaga G1 pela RPC (guarda da obra)');
select lives_ok($$ select public.excluir_obra('00000000-0000-0000-0000-00000000f001') $$, 'G apaga K');
select lives_ok($$ select public.restaurar_obra('00000000-0000-0000-0000-00000000f001') $$, 'G restaura K (obra apagada)');

-- N (membro de obras gerais sem obra): nada
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d7","role":"authenticated"}';
select is((select count(*)::int from obra where id in ('00000000-0000-0000-0000-00000000f001','00000000-0000-0000-0000-00000000f002')), 0, 'N nao ve obra');
select throws_ok(
  $$ insert into obra_fase (obra_id, ordem, titulo) values ('00000000-0000-0000-0000-00000000f002', 9, 'Intrusa') $$,
  '42501', null, 'N nao insere fase em G1');

-- X (sem pessoa): nada
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d5","role":"authenticated"}';
select is((select count(*)::int from obra where id in ('00000000-0000-0000-0000-00000000f001','00000000-0000-0000-0000-00000000f002')), 0, 'X nao ve obra');
select is((select count(*)::int from storage.objects where bucket_id = 'fotos'), 0, 'X nao ve objeto de foto');

-- Cron (sem auth.uid) passa pela guarda
reset role;
set local request.jwt.claims = '{}';
select lives_ok(
  $$ insert into obra_fase (obra_id, ordem, titulo) values ('00000000-0000-0000-0000-00000000f002', 3, 'Fase interna') $$,
  'sem auth.uid a guarda deixa passar');

select * from finish();
rollback;
