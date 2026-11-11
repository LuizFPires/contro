-- Check list (10/11/2026): responsável prestador (nome digitado), data limite da
-- pendência e foto do antes anexada depois (Não da Avaliação sem foto).
begin;
select plan(17);

-- K equipe Contorno; C coordenador de G; J membro de G.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000035d1', 'k@cpp.contro'),
  ('00000000-0000-0000-0000-0000000035d3', 'c@cpp.contro'),
  ('00000000-0000-0000-0000-0000000035d4', 'j@cpp.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000035d1', 'CPP K', 'equipe'),
  ('00000000-0000-0000-0000-0000000035d3', 'CPP C', 'equipe'),
  ('00000000-0000-0000-0000-0000000035d4', 'CPP J', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where user_id = '00000000-0000-0000-0000-0000000035d3';
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id = '00000000-0000-0000-0000-0000000035d4';

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000035f001', 'CPP K', '2026-11-02', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000035f002', 'CPP G', '2026-11-02', 'x', 'geral');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000035f002', id from pessoa
  where user_id in ('00000000-0000-0000-0000-0000000035d3', '00000000-0000-0000-0000-0000000035d4');
insert into foto (id, obra_id, storage_path) values
  ('00000000-0000-0000-0000-00000035f301', '00000000-0000-0000-0000-00000035f001', 'k/a.jpg'),
  ('00000000-0000-0000-0000-00000035f302', '00000000-0000-0000-0000-00000035f001', 'k/b.jpg'),
  ('00000000-0000-0000-0000-00000035f303', '00000000-0000-0000-0000-00000035f002', 'g/a.jpg');
-- Pendência sem foto do antes (como o Não da Avaliação cria).
insert into pendencia (id, obra_id, titulo) values
  ('00000000-0000-0000-0000-00000035f509', '00000000-0000-0000-0000-00000035f001', 'Sem foto');

set local role authenticated;

-- Contorno: K aponta com data limite e atribui a um prestador ----------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000035d1","role":"authenticated"}';
select is(
  apontar_pendencia('00000000-0000-0000-0000-00000035f501', '00000000-0000-0000-0000-00000035f001',
    'Rejunte', 'Banheiro', 'media', '00000000-0000-0000-0000-00000035f301', null, null, '2026-11-20'),
  '00000000-0000-0000-0000-00000035f501'::uuid, 'aponta com data limite');
select is((select prazo from pendencia where id = '00000000-0000-0000-0000-00000035f501'),
  '2026-11-20'::date, 'data limite gravada');
select throws_ok($$ select apontar_pendencia(gen_random_uuid(), '00000000-0000-0000-0000-00000035f001',
    'Sem foto', null, 'media', null) $$,
  '23503', null, 'apontar no Check list continua exigindo a foto');

select lives_ok($$ select atribuir_pendencia('00000000-0000-0000-0000-00000035f501', null, null, '  Zé Eletricista ') $$,
  'atribui a um prestador pelo nome');
select is((select responsavel_id::text || '|' || responsavel_nome
           from pendencia where id = '00000000-0000-0000-0000-00000035f501'), null,
  'sem pessoa do app');
select is((select responsavel_nome from pendencia where id = '00000000-0000-0000-0000-00000035f501'),
  'Zé Eletricista', 'nome do prestador gravado sem espaços');
select is((select count(*)::int from sugestao where ambiente = 'contorno' and tipo = 'pessoa' and texto = 'Zé Eletricista'),
  1, 'nome vira sugestão da Contorno');
select lives_ok($$ select atribuir_pendencia('00000000-0000-0000-0000-00000035f501',
    (select id from pessoa where user_id = '00000000-0000-0000-0000-0000000035d1'), null, 'Ignorado') $$,
  'troca para uma pessoa do app');
select is((select responsavel_nome from pendencia where id = '00000000-0000-0000-0000-00000035f501'),
  null, 'com pessoa do app o nome fica vazio');

select lives_ok($$ select definir_prazo_pendencia('00000000-0000-0000-0000-00000035f501', '2026-11-25') $$,
  'muda a data limite');
select is((select count(*)::int from pendencia_evento
           where pendencia_id = '00000000-0000-0000-0000-00000035f501' and tipo = 'prazo_alterado'),
  1, 'mudança de data limite fica no histórico');
select lives_ok($$ select definir_prazo_pendencia('00000000-0000-0000-0000-00000035f501', null) $$,
  'tira a data limite (volta ao prazo da criticidade)');

-- Foto do antes depois -------------------------------------------------------
select lives_ok($$ select anexar_foto_antes_pendencia('00000000-0000-0000-0000-00000035f509',
    '00000000-0000-0000-0000-00000035f302') $$, 'anexa a foto do antes depois');
select throws_ok($$ select anexar_foto_antes_pendencia('00000000-0000-0000-0000-00000035f509',
    '00000000-0000-0000-0000-00000035f301') $$,
  '23514', null, 'a foto do antes não é trocada');

-- Obra geral: Membro não define data limite; Coordenador sim ----------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000035d4","role":"authenticated"}';
select apontar_pendencia('00000000-0000-0000-0000-00000035f502', '00000000-0000-0000-0000-00000035f002',
  'Fissura', 'Sala', 'alta', '00000000-0000-0000-0000-00000035f303');
select throws_ok($$ select definir_prazo_pendencia('00000000-0000-0000-0000-00000035f502', '2026-11-20') $$,
  '42501', null, 'Membro não define a data limite');
select throws_ok($$ select apontar_pendencia(gen_random_uuid(), '00000000-0000-0000-0000-00000035f002',
    'Outra', null, 'alta', '00000000-0000-0000-0000-00000035f303', null, null, '2026-11-20') $$,
  '42501', null, 'Membro não aponta com data limite');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000035d3","role":"authenticated"}';
select lives_ok($$ select definir_prazo_pendencia('00000000-0000-0000-0000-00000035f502', '2026-11-20') $$,
  'Coordenador define a data limite');

select * from finish();
rollback;
