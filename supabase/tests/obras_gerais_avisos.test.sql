-- Obras gerais · Etapa 3: avisos por push. Atividade atribuída, data mudada
-- (replanejamento) e "saiu da obra" vão na hora (tipo atribuicao); ações do dia
-- por pessoa (acoes_geral) e da equipe (equipe_geral, Coordenadores e
-- Administradores) saem do gerar_avisos_gerais. A Contorno não muda.
begin;
select plan(40);

-- Elenco: A administrador (e gestor da Contorno), C coordenador de G1 e G2,
-- J membro de G1 e G2, L membro de G1, K equipe só da Contorno.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'a@avs.contro'),
  ('00000000-0000-0000-0000-0000000005a2', 'c@avs.contro'),
  ('00000000-0000-0000-0000-0000000005a3', 'j@avs.contro'),
  ('00000000-0000-0000-0000-0000000005a4', 'l@avs.contro'),
  ('00000000-0000-0000-0000-0000000005a5', 'k@avs.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000005a1', 'Avs A', 'gestor'),
  ('00000000-0000-0000-0000-0000000005a2', 'Avs C', 'equipe'),
  ('00000000-0000-0000-0000-0000000005a3', 'Avs J', 'equipe'),
  ('00000000-0000-0000-0000-0000000005a4', 'Avs L', 'equipe'),
  ('00000000-0000-0000-0000-0000000005a5', 'Avs K', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000005a1';
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where user_id = '00000000-0000-0000-0000-0000000005a2';
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id in ('00000000-0000-0000-0000-0000000005a3', '00000000-0000-0000-0000-0000000005a4');

create temp table ids as
  select split_part(nome, ' ', 2) as quem, id, user_id from pessoa
  where user_id::text like '00000000-0000-0000-0000-0000000005a_';
grant select on ids to authenticated;

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000005a001', 'Avs G1', '2031-01-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000005a002', 'Avs G2', '2031-01-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000005a003', 'Avs G3', '2031-01-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000005a004', 'Avs K', '2031-01-01', 'x', 'contorno');
-- Só estas obras contam (isola dos dados do seed e de outros testes).
update obra set status = 'pausada' where id not in (
  '00000000-0000-0000-0000-00000005a001', '00000000-0000-0000-0000-00000005a002',
  '00000000-0000-0000-0000-00000005a003', '00000000-0000-0000-0000-00000005a004');

insert into obra_participante (obra_id, pessoa_id)
  select o.id::uuid, i.id from ids i
  join (values
    ('00000000-0000-0000-0000-00000005a001', 'C'), ('00000000-0000-0000-0000-00000005a002', 'C'),
    ('00000000-0000-0000-0000-00000005a001', 'J'), ('00000000-0000-0000-0000-00000005a002', 'J'),
    ('00000000-0000-0000-0000-00000005a001', 'L')
  ) as o (id, quem) on o.quem = i.quem;

insert into obra_fase (id, obra_id, ordem, titulo) values
  ('00000000-0000-0000-0000-00000005a101', '00000000-0000-0000-0000-00000005a001', 1, 'Fase G1'),
  ('00000000-0000-0000-0000-00000005a102', '00000000-0000-0000-0000-00000005a002', 1, 'Fase G2'),
  ('00000000-0000-0000-0000-00000005a103', '00000000-0000-0000-0000-00000005a003', 1, 'Fase G3'),
  ('00000000-0000-0000-0000-00000005a104', '00000000-0000-0000-0000-00000005a004', 1, 'Fase K');

-- Atividades sem responsável (os responsáveis vêm pelas RPCs, como no app).
insert into obra_atividade (id, obra_id, fase_id, pai_id, ordem, nome, data_prevista) values
  ('00000000-0000-0000-0000-00000005a201', '00000000-0000-0000-0000-00000005a001', '00000000-0000-0000-0000-00000005a101', null, 1, 'Atv 1', null),
  ('00000000-0000-0000-0000-00000005a203', '00000000-0000-0000-0000-00000005a001', '00000000-0000-0000-0000-00000005a101', null, 3, 'Atv 3', null),
  ('00000000-0000-0000-0000-00000005a204', '00000000-0000-0000-0000-00000005a001', '00000000-0000-0000-0000-00000005a101', null, 4, 'Atv 4', null),
  ('00000000-0000-0000-0000-00000005a205', '00000000-0000-0000-0000-00000005a001', '00000000-0000-0000-0000-00000005a101', null, 5, 'Atv 5', '2031-01-07'),
  ('00000000-0000-0000-0000-00000005a208', '00000000-0000-0000-0000-00000005a001', '00000000-0000-0000-0000-00000005a101', null, 6, 'Atv 6', '2031-01-06'),
  ('00000000-0000-0000-0000-00000005a202', '00000000-0000-0000-0000-00000005a002', '00000000-0000-0000-0000-00000005a102', null, 1, 'Atv 2', null),
  ('00000000-0000-0000-0000-00000005a209', '00000000-0000-0000-0000-00000005a002', '00000000-0000-0000-0000-00000005a102', null, 2, 'Atv 7', '2031-01-08'),
  ('00000000-0000-0000-0000-00000005a213', '00000000-0000-0000-0000-00000005a003', '00000000-0000-0000-0000-00000005a103', null, 1, 'Atv 8', '2031-01-05'),
  ('00000000-0000-0000-0000-00000005a214', '00000000-0000-0000-0000-00000005a004', '00000000-0000-0000-0000-00000005a104', null, 1, 'Atv K', null);
-- Atv 5: o prazo é o do último subitem não excluído com data (10/01), não o dela (07/01).
insert into obra_atividade (id, obra_id, fase_id, pai_id, ordem, nome, data_prevista, deleted_at) values
  ('00000000-0000-0000-0000-00000005a206', '00000000-0000-0000-0000-00000005a001', '00000000-0000-0000-0000-00000005a101',
   '00000000-0000-0000-0000-00000005a205', 1, 'Sub 5a', '2031-01-10', null),
  ('00000000-0000-0000-0000-00000005a207', '00000000-0000-0000-0000-00000005a001', '00000000-0000-0000-0000-00000005a101',
   '00000000-0000-0000-0000-00000005a205', 2, 'Sub 5b', '2031-01-12', now()),
  ('00000000-0000-0000-0000-00000005a215', '00000000-0000-0000-0000-00000005a001', '00000000-0000-0000-0000-00000005a101',
   '00000000-0000-0000-0000-00000005a205', 3, 'Sub 5c', null, null);
-- Concluída e excluída de J, com data passada: não avisam nem contam.
insert into obra_atividade (id, obra_id, fase_id, ordem, nome, data_prevista, responsavel_id, concluida_em, deleted_at) values
  ('00000000-0000-0000-0000-00000005a211', '00000000-0000-0000-0000-00000005a002', '00000000-0000-0000-0000-00000005a102', 3, 'Atv concl',
   '2031-01-05', (select id from ids where quem = 'J'), now(), null),
  ('00000000-0000-0000-0000-00000005a212', '00000000-0000-0000-0000-00000005a002', '00000000-0000-0000-0000-00000005a102', 4, 'Atv excl',
   '2031-01-05', (select id from ids where quem = 'J'), null, now());

update config_avisos set acoes_ativo = true, acoes_hora = '07:30' where id;

select is((select count(*)::int from aviso_disparo where user_id in (select user_id from ids)), 0,
  'concluída ou excluída com responsável não avisa');

-- Contorno: atividade não usa responsavel_id; mesmo assim, nada é avisado.
update obra_atividade set nome = 'Atv K2', responsavel_id = (select id from ids where quem = 'K'),
  data_prevista = '2031-01-09' where id = '00000000-0000-0000-0000-00000005a214';
update obra_atividade set data_prevista = '2031-01-12' where id = '00000000-0000-0000-0000-00000005a214';
select is((select count(*)::int from aviso_disparo where user_id in (select user_id from ids)), 0,
  'atividade da Contorno não gera aviso');

-- C (coordenador de G1 e G2) planeja.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a2","role":"authenticated"}';
select definir_responsavel_atividade('00000000-0000-0000-0000-00000005a204', (select id from ids where quem = 'J'));
select definir_data_prevista('00000000-0000-0000-0000-00000005a204', '2031-01-08');
select definir_data_prevista('00000000-0000-0000-0000-00000005a201', '2031-01-07');
select definir_responsavel_atividade('00000000-0000-0000-0000-00000005a201', (select id from ids where quem = 'J'));
select definir_responsavel_atividade('00000000-0000-0000-0000-00000005a205', (select id from ids where quem = 'J'));
select definir_responsavel_atividade('00000000-0000-0000-0000-00000005a208', (select id from ids where quem = 'L'));
select definir_responsavel_atividade('00000000-0000-0000-0000-00000005a202', (select id from ids where quem = 'J'));
reset role;
create temp table antes_null as select count(*)::int as n from aviso_disparo where tipo = 'atribuicao';
set local role authenticated;
select definir_responsavel_atividade('00000000-0000-0000-0000-00000005a202', null);
select definir_responsavel_atividade('00000000-0000-0000-0000-00000005a203', (select id from ids where quem = 'C'));
reset role;

select is((select count(*)::int from aviso_disparo where tipo = 'atribuicao'), (select n from antes_null),
  'trocar para sem responsável e atribuir a si mesmo não avisam');
select is((select count(*)::int from aviso_disparo
  where user_id = (select user_id from ids where quem = 'C')), 0, 'quem atribui a si mesmo não recebe aviso');
select results_eq(
  $$ select tipo, titulo, corpo, url from aviso_disparo
     where user_id = (select user_id from ids where quem = 'J') order by corpo $$,
  $$ values
    ('atribuicao'::text, 'CONTRO · Avs G1'::text, 'Nova atividade para você: Atv 1 · até 07/01'::text, '/?ir=geral-hoje'::text),
    ('atribuicao', 'CONTRO · Avs G2', 'Nova atividade para você: Atv 2', '/?ir=geral-hoje'),
    ('atribuicao', 'CONTRO · Avs G1', 'Nova atividade para você: Atv 4', '/?ir=geral-hoje'),
    ('atribuicao', 'CONTRO · Avs G1', 'Nova atividade para você: Atv 5 · até 10/01', '/?ir=geral-hoje') $$,
  'J recebe uma atribuição por atividade (sem data: sem "até"; com subitens: o último subitem); a primeira data não avisa');
select is((select corpo from aviso_disparo where user_id = (select user_id from ids where quem = 'L')),
  'Nova atividade para você: Atv 6 · até 06/01', 'L recebe a atribuição dela');
select is((select dia from aviso_disparo where user_id = (select user_id from ids where quem = 'L')),
  (now() at time zone 'America/Sao_Paulo')::date, 'atribuição vale para o dia de hoje');

-- Replanejamento avisa o responsável; o Desfazer não avisa de novo.
set local role authenticated;
select set_config('avs.ev', definir_data_prevista('00000000-0000-0000-0000-00000005a201', '2031-01-09')::text, true);
reset role;
select is((select corpo from aviso_disparo where corpo like 'Nova data:%'
  and user_id = (select user_id from ids where quem = 'J')),
  'Nova data: Atv 1 · 07/01 → 09/01', 'replanejar avisa o responsável com a data antiga e a nova');
select is((select titulo from aviso_disparo where corpo like 'Nova data:%'), 'CONTRO · Avs G1', 'título com a obra');
set local role authenticated;
select desfazer_data_prevista(current_setting('avs.ev')::uuid);
reset role;
select is((select data_prevista from obra_atividade where id = '00000000-0000-0000-0000-00000005a201'),
  '2031-01-07'::date, 'Desfazer volta a data');
select is((select count(*)::int from aviso_disparo where corpo like 'Nova data:%'), 1, 'Desfazer não manda "Nova data"');

-- Concluída: mudar a data não avisa.
set local role authenticated;
select definir_data_prevista('00000000-0000-0000-0000-00000005a211', '2031-01-04');
reset role;
select is((select count(*)::int from aviso_disparo where corpo like 'Nova data:%'), 1, 'atividade concluída não avisa data');

-- Atividade nova já com responsável (adicionar_atividade_geral) avisa.
set local role authenticated;
select adicionar_atividade_geral('00000000-0000-0000-0000-00000005a002', '00000000-0000-0000-0000-00000005a102',
  'Atv nova', (select id from ids where quem = 'J'), '2031-02-02');
reset role;
select is((select count(*)::int from aviso_disparo where corpo = 'Nova atividade para você: Atv nova · até 02/02'
  and titulo = 'CONTRO · Avs G2' and user_id = (select user_id from ids where quem = 'J')), 1,
  'atividade criada com responsável avisa');

-- Sem login (auth.uid() nulo): avisa normalmente. A é Administrador (vê G3).
set local request.jwt.claims = '{}';
update obra_atividade set responsavel_id = (select id from ids where quem = 'A')
  where id = '00000000-0000-0000-0000-00000005a213';
select is((select corpo from aviso_disparo where user_id = (select user_id from ids where quem = 'A')),
  'Nova atividade para você: Atv 8 · até 05/01', 'sem login, avisa o responsável');
-- Forçado sem as RPCs: responsável que não participa de G3 nem é Administrador
-- não recebe aviso (nem de atribuição nem de data).
update obra_atividade set responsavel_id = (select id from ids where quem = 'C')
  where id = '00000000-0000-0000-0000-00000005a213';
update obra_atividade set data_prevista = '2031-01-06' where id = '00000000-0000-0000-0000-00000005a213';
update obra_atividade set data_prevista = '2031-01-05' where id = '00000000-0000-0000-0000-00000005a213';
select is((select count(*)::int from aviso_disparo where user_id = (select user_id from ids where quem = 'C')), 0,
  'quem não participa da obra nem é Administrador não recebe aviso');
update obra_atividade set responsavel_id = null where id = '00000000-0000-0000-0000-00000005a213';
delete from aviso_disparo where user_id = (select user_id from ids where quem = 'A');

-- gerar_avisos_gerais: quarta 08/01/2031. J: Atv 1 atrasada (07/01) e Atv 4
-- hoje; Atv 5 vence 10/01 (subitem); Atv 2 sem responsável e sem data; Atv nova
-- em fevereiro. L: Atv 6 atrasada (06/01). Sem responsável: Atv 7 hoje (G2) e
-- Atv 8 atrasada (G3, que C não vê).
select is(gerar_avisos_gerais('2031-01-11 07:40-03'), 0, 'sábado: nada');
select is(gerar_avisos_gerais('2031-01-08 07:20-03'), 0, 'antes do horário: nada');
select is(gerar_avisos_gerais('2031-01-08 10:40-03'), 0, 'depois da janela de 3 h: nada');
update config_avisos set acoes_ativo = false where id;
select is(gerar_avisos_gerais('2031-01-08 07:40-03'), 0, 'desligado: nada');
update config_avisos set acoes_ativo = true where id;

select set_config('avs.n', gerar_avisos_gerais('2031-01-08 07:40-03')::text, true);
select is(current_setting('avs.n')::int,
  (select count(*)::int from aviso_disparo where dia = '2031-01-08' and tipo in ('acoes_geral', 'equipe_geral')),
  'devolve quantos inseriu');
-- J e L (acoes_geral), C e A (equipe_geral) e cada outro Administrador ativo do
-- seed (equipe_geral de todas as obras gerais).
select is(current_setting('avs.n')::int,
  4 + (select count(*)::int from pessoa where administrador and ativo and deleted_at is null
       and user_id is not null and user_id not in (select user_id from ids)),
  'destinatários exatos: J, L, C, A e os outros Administradores');
select is(gerar_avisos_gerais('2031-01-08 08:45-03'), 0, 'rodar de novo no mesmo dia não duplica');

select results_eq(
  $$ select tipo, titulo, corpo, url from aviso_disparo
     where dia = '2031-01-08' and user_id = (select user_id from ids where quem = 'J') $$,
  $$ values ('acoes_geral'::text, 'CONTRO · Obras gerais'::text,
             '1 atrasada e 1 vence hoje. Toque para ver a lista.'::text, '/?ir=geral-hoje'::text) $$,
  'J: as suas atrasadas e de hoje (sem data, concluída, excluída e futura ficam fora)');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'acoes_geral'
  and user_id = (select user_id from ids where quem = 'L')), '1 atrasada. Toque para ver a lista.', 'L: 1 atrasada');
select results_eq(
  $$ select tipo, titulo, corpo, url from aviso_disparo
     where dia = '2031-01-08' and user_id = (select user_id from ids where quem = 'C') $$,
  $$ values ('equipe_geral'::text, 'CONTRO · Obras gerais · equipe'::text,
             '2 atrasadas e 2 vencem hoje · Avs J 1+1, Avs L 1+0.'::text, '/?ir=geral-hoje'::text) $$,
  'C: um aviso da equipe somando G1 e G2 ("Sem responsável" só nos totais), sem G3');
select results_eq(
  $$ select tipo, corpo from aviso_disparo
     where dia = '2031-01-08' and tipo in ('acoes_geral', 'equipe_geral')
       and user_id = (select user_id from ids where quem = 'A') $$,
  $$ values ('equipe_geral'::text, '3 atrasadas e 2 vencem hoje · Avs J 1+1, Avs L 1+0.'::text) $$,
  'A (administrador): todas as obras gerais');
select is((select count(*)::int from aviso_disparo where tipo in ('acoes_geral', 'equipe_geral')
  and user_id = (select user_id from ids where quem = 'K')), 0, 'pessoa só da Contorno não recebe aviso geral');
select is((select count(*)::int from aviso_disparo where tipo in ('acoes_geral', 'equipe_geral')
  and user_id not in (select p.user_id from pessoa p where p.user_id is not null
                      and (p.administrador or p.papel_geral is not null))), 0,
  'só quem está em Obras gerais recebe aviso geral');

-- A Contorno, no mesmo cenário (mais uma tarefa atrasada de K), não conta as
-- atividades gerais.
insert into tarefa (obra_id, texto, prazo, responsavel_id) values
  ('00000000-0000-0000-0000-00000005a004', 'Tarefa K', '2031-01-07', (select id from ids where quem = 'K'));
select gerar_avisos('2031-01-08 07:40-03');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'acoes_equipe'
  and user_id = (select user_id from ids where quem = 'A')), '1 atrasada · Avs K 1+0.', 'Equipe hoje da Contorno só conta a Contorno');
select is((select corpo from aviso_disparo where dia = '2031-01-08' and tipo = 'acoes'
  and user_id = (select user_id from ids where quem = 'K')), '1 atrasada. Toque para ver a lista.', 'K recebe o da Contorno');
select is((select count(*)::int from aviso_disparo where dia = '2031-01-08' and tipo in ('acoes', 'acoes_equipe')
  and user_id in (select user_id from ids where quem in ('C', 'J', 'L'))), 0, 'quem é só de Obras gerais não recebe o da Contorno');

-- Saída da obra: A remove J de G1 (Atv 1, 4 e 5 abertas) → C é avisado, A não.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}';
select remover_da_obra('00000000-0000-0000-0000-00000005a001', (select id from ids where quem = 'J'));
reset role;
select results_eq(
  $$ select titulo, corpo, url from aviso_disparo
     where corpo like '%saiu da obra%' and user_id = (select user_id from ids where quem = 'C') $$,
  $$ values ('CONTRO · Avs G1'::text, 'Avs J saiu da obra. 3 atividades ficaram sem responsável.'::text,
             '/?ir=geral-hoje'::text) $$,
  'Coordenador da obra é avisado de quem saiu e de quantas ficaram sem responsável');
select is((select count(*)::int from aviso_disparo where corpo like '%saiu da obra%'
  and user_id in (select user_id from ids where quem in ('A', 'J', 'L', 'K'))), 0,
  'quem removeu, quem saiu, membros e a Contorno não são avisados');
select is((select count(*)::int from aviso_disparo where corpo like 'Avs J saiu da obra%'
  and user_id not in (select user_id from ids)),
  (select count(*)::int from pessoa where administrador and ativo and deleted_at is null and user_id is not null
     and user_id not in (select user_id from ids)),
  'cada outro Administrador ativo é avisado');
select is((select count(*)::int from aviso_disparo where tipo = 'atribuicao'
  and corpo like 'Nova%' and dia = (now() at time zone 'America/Sao_Paulo')::date
  and user_id = (select user_id from ids where quem = 'J')), 6, 'tirar o responsável não manda atribuição');

-- C remove L de G1 (Atv 6) → A é avisado, C não.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a2","role":"authenticated"}';
select remover_da_obra('00000000-0000-0000-0000-00000005a001', (select id from ids where quem = 'L'));
reset role;
select is((select corpo from aviso_disparo where corpo like 'Avs L saiu%'
  and user_id = (select user_id from ids where quem = 'A')),
  'Avs L saiu da obra. 1 atividade ficou sem responsável.', 'Administrador é avisado (singular)');
select is((select count(*)::int from aviso_disparo where corpo like 'Avs L saiu%'
  and user_id = (select user_id from ids where quem = 'C')), 0, 'quem removeu não é avisado');

-- Sem atividade aberta: sair não avisa (A remove C de G2, onde C não é responsável).
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}';
select remover_da_obra('00000000-0000-0000-0000-00000005a002', (select id from ids where quem = 'C'));
reset role;
select is((select count(*)::int from aviso_disparo where corpo like 'Avs C saiu%'), 0, 'sem atividade aberta: nenhum aviso');

-- Rotina protegida e agendada.
select ok(not has_function_privilege('authenticated', 'public.gerar_avisos_gerais(timestamptz)', 'execute'),
  'authenticated não executa gerar_avisos_gerais');
select ok(not has_function_privilege('anon', 'public.gerar_avisos_gerais(timestamptz)', 'execute'),
  'anon não executa gerar_avisos_gerais');

select * from finish();
rollback;
