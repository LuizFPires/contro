-- Obras gerais: criar obra geral, dar acesso e convite pelo e-mail.
begin;
select plan(54);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'm@rpc.contro'),
  ('00000000-0000-0000-0000-0000000000d2', 'a@rpc.contro'),
  ('00000000-0000-0000-0000-0000000000d3', 'pendente@rpc.contro'),
  ('00000000-0000-0000-0000-0000000000d4', 'ativo@rpc.contro'),
  ('00000000-0000-0000-0000-0000000000d7', 'desativado@rpc.contro'),
  ('00000000-0000-0000-0000-0000000000d8', 'recusado@rpc.contro');
update pessoa set nome = 'Pessoa M', ativo = true where user_id = '00000000-0000-0000-0000-0000000000d1';
update pessoa set nome = 'Pessoa A', perfil = 'gestor', ativo = true, administrador = true
  where user_id = '00000000-0000-0000-0000-0000000000d2';
update pessoa set nome = 'Pendente P' where user_id = '00000000-0000-0000-0000-0000000000d3';
update pessoa set nome = 'Ativo K', ativo = true where user_id = '00000000-0000-0000-0000-0000000000d4';
update pessoa set nome = 'Desativado D', ativo = false, desativado_em = now() where user_id = '00000000-0000-0000-0000-0000000000d7';
update pessoa set nome = 'Recusado R', ativo = false, deleted_at = now() where user_id = '00000000-0000-0000-0000-0000000000d8';

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000000f001', 'Obra K', '2026-11-02', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000000f002', 'Obra G1', '2026-11-02', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000000f003', 'Obra G2 excluída', '2026-11-02', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000000f004', 'Obra G3', '2026-11-02', 'x', 'geral');
update obra set deleted_at = now() where id = '00000000-0000-0000-0000-00000000f003';

set local role authenticated;

-- M (não admin)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select throws_ok($$ select criar_obra_geral('X', 'Y') $$, '42501', null, 'M nao cria obra geral');
select throws_ok($$ select salvar_acesso_geral('x@x.com', 'X', 'membro', '{}') $$, '42501', null, 'M nao salva acesso');
select throws_ok($$ select definir_acesso_geral((select id from pessoa where user_id = '00000000-0000-0000-0000-0000000000d1'), 'membro', '{}') $$, '42501', null, 'M nao define acesso');
select throws_ok($$ select * from listar_pessoas_gerais() $$, '42501', null, 'M nao lista pessoas gerais');

-- A (admin)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select isnt(criar_obra_geral('  Galpão SMS ', ' Betim ', '00000000-0000-0000-0000-00000000f0aa'), null, 'A cria obra geral');
select is((select ambiente from obra where id = '00000000-0000-0000-0000-00000000f0aa'), 'geral', 'obra nasce geral');
select is((select cidade from obra where id = '00000000-0000-0000-0000-00000000f0aa'), 'Betim', 'cidade gravada sem espacos');
select is((select nome from obra where id = '00000000-0000-0000-0000-00000000f0aa'), 'Galpão SMS', 'nome gravado sem espacos');
select is((select status::text from obra where id = '00000000-0000-0000-0000-00000000f0aa'), 'ativa', 'obra ativa');
select is((select inicio from obra where id = '00000000-0000-0000-0000-00000000f0aa'), current_date, 'inicio hoje');
select is(criar_obra_geral('Galpão SMS', 'Betim', '00000000-0000-0000-0000-00000000f0aa'), '00000000-0000-0000-0000-00000000f0aa'::uuid, 'mesmo p_id devolve o id');
select is((select count(*)::int from obra where nome = 'Galpão SMS'), 1, 'mesmo p_id nao duplica');
select is((select cidade from obra where id = criar_obra_geral('Sem cidade', '  ')), null, 'cidade vazia vira null');
select throws_ok($$ select criar_obra_geral('Outra', 'x', '00000000-0000-0000-0000-00000000f001') $$, '23505', null, 'id de obra contorno nao e reaproveitado');
select throws_ok($$ select criar_obra_geral('Outra', 'x', '00000000-0000-0000-0000-00000000f003') $$, '23505', null, 'id de obra geral excluida nao e reaproveitado');
select throws_ok($$ select criar_obra_geral('  ', 'x') $$, '22023', null, 'nome vazio e rejeitado');
select throws_ok($$ select criar_obra_geral(repeat('a', 81), 'x') $$, '22023', null, 'nome acima de 80 e rejeitado');
select throws_ok($$ select criar_obra_geral('Ok', repeat('a', 61)) $$, '22023', null, 'cidade acima de 60 e rejeitada');

-- Convite (sem usuário)
select is(salvar_acesso_geral('  Carlos@Email.COM ', 'Carlos', 'coordenador', array['00000000-0000-0000-0000-00000000f002'::uuid]), null, 'sem usuario devolve null');
select is((select papel from convite_geral where email = 'carlos@email.com'), 'coordenador', 'convite criado com e-mail normalizado');
select is(salvar_acesso_geral('carlos@email.com', 'Carlos', 'coordenador', array['00000000-0000-0000-0000-00000000f002'::uuid]), null, 'convite repetido atualiza');
select is((select count(*)::int from convite_geral where email = 'carlos@email.com'), 1, 'convite nao duplica');

-- Validação
select throws_ok($$ select salvar_acesso_geral('z@x.com', 'Z', 'membro', array['00000000-0000-0000-0000-00000000f001'::uuid]) $$, '22023', null, 'obra contorno e rejeitada');
select throws_ok($$ select salvar_acesso_geral('z@x.com', 'Z', 'membro', array['00000000-0000-0000-0000-00000000f003'::uuid]) $$, '22023', null, 'obra excluida e rejeitada');
select throws_ok($$ select salvar_acesso_geral('z@x.com', 'Z', 'chefe', '{}') $$, '22023', null, 'papel invalido e rejeitado');
select throws_ok($$ select salvar_acesso_geral('  ', 'Z', 'membro', '{}') $$, '22023', null, 'e-mail vazio e rejeitado');

-- Usuário pendente na Contorno vira só Obras gerais
select is(
  salvar_acesso_geral('PENDENTE@rpc.contro', 'Novo Nome', 'membro', array['00000000-0000-0000-0000-00000000f002'::uuid]),
  (select id from pessoa where user_id = '00000000-0000-0000-0000-0000000000d3'),
  'usuario existente devolve pessoa.id');
select is(
  (select row(ativo, acesso_contorno, papel_geral, nome)::text from pessoa where user_id = '00000000-0000-0000-0000-0000000000d3'),
  row(true, false, 'membro', 'Novo Nome')::text,
  'pendente vira ativo, sem Contorno, com papel e nome');
select is(
  (select count(*)::int from obra_participante op join pessoa p on p.id = op.pessoa_id
   where p.user_id = '00000000-0000-0000-0000-0000000000d3' and op.obra_id = '00000000-0000-0000-0000-00000000f002'),
  1, 'pendente participa de G1');

-- Usuário ativo na Contorno mantém a Contorno; nome só na primeira vez
select lives_ok($$ select salvar_acesso_geral('ativo@rpc.contro', 'Outro', 'coordenador', '{}') $$, 'salva acesso de ativo');
select is(
  (select row(ativo, acesso_contorno, papel_geral, nome, perfil::text, administrador)::text from pessoa where user_id = '00000000-0000-0000-0000-0000000000d4'),
  row(true, true, 'coordenador', 'Outro', 'equipe', false)::text,
  'ativo mantem Contorno e perfil');
select lives_ok($$ select salvar_acesso_geral('ativo@rpc.contro', 'Terceiro', 'membro', '{}') $$, 'salva de novo');
select is((select nome from pessoa where user_id = '00000000-0000-0000-0000-0000000000d4'), 'Outro', 'nome nao muda quando ja tinha papel geral');

-- Membro desativado da Contorno não volta à Contorno ao ganhar acesso geral
select lives_ok($$ select salvar_acesso_geral('desativado@rpc.contro', 'D', 'membro', '{}') $$, 'salva acesso de desativado');
select is(
  (select row(ativo, acesso_contorno, papel_geral, desativado_em is null)::text from pessoa where user_id = '00000000-0000-0000-0000-0000000000d7'),
  row(true, false, 'membro', true)::text,
  'desativado entra so nas obras gerais');

-- Recusado (deleted_at) volta só nas obras gerais
select lives_ok($$ select salvar_acesso_geral('recusado@rpc.contro', 'R', 'membro', '{}') $$, 'salva acesso de recusado');
select is(
  (select row(ativo, acesso_contorno, deleted_at is null, desativado_em is null)::text from pessoa where user_id = '00000000-0000-0000-0000-0000000000d8'),
  row(true, false, true, true)::text,
  'recusado volta ativo, so nas obras gerais');

-- Convite com obra excluída depois de salvo
select is(salvar_acesso_geral('beto@email.com', 'Beto', 'membro',
  array['00000000-0000-0000-0000-00000000f002'::uuid, '00000000-0000-0000-0000-00000000f004'::uuid]), null, 'convite de Beto com G1 e G3');

-- Cadastro com convite
reset role;
update obra set deleted_at = now() where id = '00000000-0000-0000-0000-00000000f004';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d9', 'Beto@Email.com');
select is(
  (select array_agg(op.obra_id) from obra_participante op join pessoa p on p.id = op.pessoa_id
   where p.user_id = '00000000-0000-0000-0000-0000000000d9'),
  array['00000000-0000-0000-0000-00000000f002'::uuid],
  'convite com obra excluida: so G1 vira participacao');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d5', 'carlos@email.com');
select is(
  (select row(ativo, acesso_contorno, papel_geral, nome)::text from pessoa where user_id = '00000000-0000-0000-0000-0000000000d5'),
  row(true, false, 'coordenador', 'Carlos')::text,
  'cadastro com convite nasce ativo, coordenador, sem Contorno');
select is(
  (select array_agg(op.obra_id) from obra_participante op join pessoa p on p.id = op.pessoa_id
   where p.user_id = '00000000-0000-0000-0000-0000000000d5'),
  array['00000000-0000-0000-0000-00000000f002'::uuid],
  'cadastro com convite participa de G1');
select isnt((select usado_em from convite_geral where email = 'carlos@email.com'), null, 'convite marcado como usado');

-- Cadastro sem convite: igual a hoje
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d6', 'sem@convite.com');
select is(
  (select row(ativo, acesso_contorno, papel_geral)::text from pessoa where user_id = '00000000-0000-0000-0000-0000000000d6'),
  row(false, true, null::text)::text,
  'cadastro sem convite nasce pendente');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select is(
  (select row(email, papel, obra_ids)::text from listar_pessoas_gerais() where nome = 'Carlos'),
  row('carlos@email.com', 'coordenador', array['00000000-0000-0000-0000-00000000f002'::uuid])::text,
  'A lista Carlos com e-mail, papel e obras');
select is((select count(*)::int from listar_pessoas_gerais() where nome in ('Pessoa M', 'Pessoa A')), 0, 'lista so quem tem papel geral');

-- definir_acesso_geral
select lives_ok(
  $$ select definir_acesso_geral((select id from pessoa where user_id = '00000000-0000-0000-0000-0000000000d5'), 'membro', '{}') $$,
  'A define acesso de Carlos');
select is(
  (select count(*)::int from obra_participante op join pessoa p on p.id = op.pessoa_id
   where p.user_id = '00000000-0000-0000-0000-0000000000d5'),
  0, 'Carlos sem participacoes');
select is((select papel_geral from pessoa where user_id = '00000000-0000-0000-0000-0000000000d5'), 'membro', 'Carlos vira membro');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d5","role":"authenticated"}';
select ok(contro_tem_acesso(), 'Carlos continua com acesso');
select ok(not contro_ve_obra('00000000-0000-0000-0000-00000000f002'), 'Carlos nao ve G1');
select is((select count(*)::int from pessoa where user_id = '00000000-0000-0000-0000-0000000000d5'), 1, 'Carlos ve a si mesmo');

-- Contorno não vê quem está só nas obras gerais
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is((select count(*)::int from pessoa where user_id = '00000000-0000-0000-0000-0000000000d5'), 0, 'M nao ve pessoa so geral');
select is((select count(*)::int from pessoa where user_id = '00000000-0000-0000-0000-0000000000d2'), 1, 'M ve outra pessoa da Contorno');
select is((select count(*)::int from pessoa where user_id = '00000000-0000-0000-0000-0000000000d4'), 1, 'M ve pessoa nos dois ambientes');

select * from finish();
rollback;
