-- Obras gerais · Etapa 4 (decisão 8): boletim por obra geral.
-- config_boletim_obra (Administrador grava), gerar_disparos_boletim_geral
-- (disparo + aviso boletim_geral), marcar enviado por quem planeja.
-- A Contorno não muda. Fuso America/Sao_Paulo (UTC-3); 2031-01-06 é segunda.
begin;
select plan(37);

-- Elenco: A administrador (gestor da Contorno), C coordenador de G1,
-- D coordenador de G2, M membro de G1, K gestor só da Contorno.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007b1', 'a@bol.contro'),
  ('00000000-0000-0000-0000-0000000007b2', 'c@bol.contro'),
  ('00000000-0000-0000-0000-0000000007b3', 'd@bol.contro'),
  ('00000000-0000-0000-0000-0000000007b4', 'm@bol.contro'),
  ('00000000-0000-0000-0000-0000000007b5', 'k@bol.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000007b1', 'Bol A', 'gestor'),
  ('00000000-0000-0000-0000-0000000007b2', 'Bol C', 'equipe'),
  ('00000000-0000-0000-0000-0000000007b3', 'Bol D', 'equipe'),
  ('00000000-0000-0000-0000-0000000007b4', 'Bol M', 'equipe'),
  ('00000000-0000-0000-0000-0000000007b5', 'Bol K', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set administrador = true where user_id = '00000000-0000-0000-0000-0000000007b1';
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where user_id in ('00000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-0000000007b3');
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id = '00000000-0000-0000-0000-0000000007b4';
-- Isola dos Administradores do seed/outros testes (destinatários contados abaixo).
update pessoa set administrador = false
  where administrador and user_id <> '00000000-0000-0000-0000-0000000007b1';

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000007b001', 'Bol G1', '2031-01-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000007b002', 'Bol G2', '2031-01-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000007b003', 'Bol G3', '2031-01-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000007b004', 'Bol K', '2031-01-01', 'x', 'contorno');
update obra set status = 'pausada' where id not in (
  '00000000-0000-0000-0000-00000007b001', '00000000-0000-0000-0000-00000007b002',
  '00000000-0000-0000-0000-00000007b003', '00000000-0000-0000-0000-00000007b004');

insert into obra_participante (obra_id, pessoa_id)
  select o.id::uuid, p.id from pessoa p
  join (values
    ('00000000-0000-0000-0000-00000007b001', '00000000-0000-0000-0000-0000000007b2'),
    ('00000000-0000-0000-0000-00000007b002', '00000000-0000-0000-0000-0000000007b3'),
    ('00000000-0000-0000-0000-00000007b001', '00000000-0000-0000-0000-0000000007b4')
  ) as o (id, uid) on p.user_id = o.uid::uuid;

-- Contorno: segunda 06:30, sem fechamento.
update config_boletim set ativo = true, dia_semana = 1, hora = '06:30', fechamento_ativo = false where id;

-- 1) Config da obra -----------------------------------------------------------

select ok((select relrowsecurity from pg_class where oid = 'public.config_boletim_obra'::regclass),
  'RLS em config_boletim_obra');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007b1","role":"authenticated"}';
select is(salvar_config_boletim_obra('00000000-0000-0000-0000-00000007b001',
    '{"dia_semana":3,"hora":"08:00"}'::jsonb),
  jsonb_build_object('obra_id', '00000000-0000-0000-0000-00000007b001', 'ativo', true,
    'dia_semana', 3, 'hora', '08:00:00', 'fechamento_ativo', false, 'fechamento_dia', 5,
    'fechamento_hora', '17:00:00'),
  'Administrador salva a config (parcial: o resto com os padrões)');
select is(salvar_config_boletim_obra('00000000-0000-0000-0000-00000007b001',
    '{"fechamento_ativo":true,"fechamento_hora":"18:00"}'::jsonb) ->> 'hora',
  '08:00:00', 'segunda gravação mantém o que não veio');
select is((select fechamento_hora from config_boletim_obra where obra_id = '00000000-0000-0000-0000-00000007b001'),
  '18:00'::time, 'fechamento gravado');
select is((select updated_by from config_boletim_obra where obra_id = '00000000-0000-0000-0000-00000007b001'),
  (select id from pessoa where user_id = '00000000-0000-0000-0000-0000000007b1'), 'updated_by = quem salvou');
select throws_ok($$ select salvar_config_boletim_obra('00000000-0000-0000-0000-00000007b001', '{"dia_semana":8}'::jsonb) $$,
  '22023', null, 'dia fora do CHECK → 22023');
select throws_ok($$ select salvar_config_boletim_obra('00000000-0000-0000-0000-00000007b001', '{"hora":"25:00"}'::jsonb) $$,
  '22023', null, 'hora inválida → 22023');
select throws_ok($$ select salvar_config_boletim_obra('00000000-0000-0000-0000-00000007b001', '{"ativo":null}'::jsonb) $$,
  '22023', null, 'nulo → 22023');
select throws_ok($$ select salvar_config_boletim_obra('00000000-0000-0000-0000-00000007b001', '[]'::jsonb) $$,
  '22023', null, 'não objeto → 22023');
select throws_ok($$ select salvar_config_boletim_obra('00000000-0000-0000-0000-00000007b004', '{}'::jsonb) $$,
  '23505', null, 'obra Contorno → 23505');
select throws_ok($$ select salvar_config_boletim_obra('00000000-0000-0000-0000-00000007b0ff', '{}'::jsonb) $$,
  '23503', null, 'obra inexistente → 23503');
select throws_ok($$ insert into config_boletim_obra (obra_id) values ('00000000-0000-0000-0000-00000007b003') $$,
  '42501', null, 'sem escrita direta (nem o Administrador)');

-- Coordenador lê e grava a da obra dele (06/11/2026); Membro só lê.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007b2","role":"authenticated"}';
select is((select count(*)::int from config_boletim_obra), 1, 'Coordenador lê a config da obra dele');
select is(salvar_config_boletim_obra('00000000-0000-0000-0000-00000007b001', '{"hora":"08:00"}'::jsonb) ->> 'hora',
  '08:00:00', 'Coordenador grava a config da obra dele');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007b4","role":"authenticated"}';
select is((select count(*)::int from config_boletim_obra), 1, 'Membro lê a config da obra dele');
select throws_ok($$ select salvar_config_boletim_obra('00000000-0000-0000-0000-00000007b001', '{"hora":"09:00"}'::jsonb) $$,
  '42501', null, 'Membro não grava');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007b3","role":"authenticated"}';
select is((select count(*)::int from config_boletim_obra), 0, 'Coordenador de outra obra não lê');
select throws_ok($$ select salvar_config_boletim_obra('00000000-0000-0000-0000-00000007b001', '{}'::jsonb) $$,
  '23503', null, 'quem não vê a obra → 23503');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007b5","role":"authenticated"}';
select is((select count(*)::int from config_boletim_obra), 0, 'Contorno não lê config de obra geral');

-- G2 com config desligada; G3 sem config.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007b1","role":"authenticated"}';
select lives_ok($$ select salvar_config_boletim_obra('00000000-0000-0000-0000-00000007b002',
  '{"ativo":false,"dia_semana":3,"hora":"08:00"}'::jsonb) $$, 'G2 desligada');

select throws_ok($$ select gerar_disparos_boletim_geral('2031-01-08 11:05:00+00') $$,
  '42501', null, 'authenticated não executa gerar_disparos_boletim_geral');

reset role;

-- 2) Disparo ------------------------------------------------------------------

-- Quarta 07:59 BRT: antes da hora.
select is(gerar_disparos_boletim_geral('2031-01-08 10:59:00+00'), 0, 'antes da hora não dispara');
-- Quarta 08:05 BRT: G1 dispara; G2 desligada e G3 sem config não.
select is(gerar_disparos_boletim_geral('2031-01-08 11:05:00+00'), 1, 'no dia e hora dispara');
select results_eq(
  $$ select obra_id, semana_inicio, edicao::text, notificado_em is not null
     from boletim_disparo where obra_id::text like '00000000-0000-0000-0000-00000007b00_' $$,
  $$ values ('00000000-0000-0000-0000-00000007b001'::uuid, '2031-01-06'::date, 'principal', true) $$,
  'só G1 (G2 desligada, G3 sem config, Contorno não é quarta); nasce notificado');
select results_eq(
  $$ select p.nome, a.dia, a.titulo, a.corpo, a.url
     from aviso_disparo a join pessoa p on p.user_id = a.user_id
     where a.tipo = 'boletim_geral' order by p.nome $$,
  $$ values
     ('Bol A'::text, '2031-01-08'::date, 'CONTRO · Boletim'::text, 'Boletim pronto · Bol G1'::text,
      '/?ir=geral-boletim&obra=00000000-0000-0000-0000-00000007b001'::text),
     ('Bol C', '2031-01-08', 'CONTRO · Boletim', 'Boletim pronto · Bol G1',
      '/?ir=geral-boletim&obra=00000000-0000-0000-0000-00000007b001') $$,
  'aviso para o Coordenador da obra e o Administrador (Membro e outro Coordenador não)');
select is(gerar_disparos_boletim_geral('2031-01-08 11:20:00+00'), 0, 'de novo: dedupe por semana e edição');
select is((select count(*)::int from aviso_disparo where tipo = 'boletim_geral'), 2, 'sem aviso repetido');

-- Fechamento sexta 18:00 BRT.
select is(gerar_disparos_boletim_geral('2031-01-10 21:05:00+00'), 1, 'fechamento dispara');
select is((select count(*)::int from boletim_disparo
  where obra_id = '00000000-0000-0000-0000-00000007b001' and edicao = 'fechamento'), 1, 'edição de fechamento gravada');

-- Duas obras na mesma rodada: um aviso por pessoa listando as duas.
insert into config_boletim_obra (obra_id, dia_semana, hora)
  values ('00000000-0000-0000-0000-00000007b003', 3, '08:00');
select is(gerar_disparos_boletim_geral('2031-01-15 11:05:00+00'), 2, 'G1 e G3 disparam na semana seguinte');
select results_eq(
  $$ select p.nome, a.corpo, a.url from aviso_disparo a join pessoa p on p.user_id = a.user_id
     where a.tipo = 'boletim_geral' and a.dia = '2031-01-15' order by p.nome $$,
  $$ values
     ('Bol A'::text, 'Boletins prontos · Bol G1 · Bol G3'::text,
      '/?ir=geral-boletim&obra=00000000-0000-0000-0000-00000007b001'::text),
     ('Bol C', 'Boletim pronto · Bol G1', '/?ir=geral-boletim&obra=00000000-0000-0000-0000-00000007b001') $$,
  'Administrador recebe um aviso com as duas obras; Coordenador só a dele');
delete from boletim_disparo where semana_inicio = '2031-01-13';

-- Contorno igual: gerar_disparos_boletim só pega a obra Contorno; a geral não.
select is(gerar_disparos_boletim('2031-01-13 09:35:00+00'), 1, 'gerar_disparos_boletim da Contorno igual (só Contorno)');
select is((select count(*)::int from boletim_disparo
  where obra_id = '00000000-0000-0000-0000-00000007b004' and notificado_em is null), 1,
  'disparo da Contorno segue para o enviar-push-boletim');

-- 3) Marcar enviado -----------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007b4","role":"authenticated"}';
update boletim_disparo set enviado_em = now() where obra_id = '00000000-0000-0000-0000-00000007b001';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007b2","role":"authenticated"}';
select is((select count(*)::int from boletim_disparo where enviado_em is not null), 0,
  'Membro não marca enviado');
update boletim_disparo set enviado_em = now() where obra_id = '00000000-0000-0000-0000-00000007b001';
select is((select count(*)::int from boletim_disparo where enviado_em is not null), 2,
  'Coordenador marca enviado na obra dele');
update boletim_disparo set enviado_em = now() where obra_id = '00000000-0000-0000-0000-00000007b004';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007b5","role":"authenticated"}';
select is((select count(*)::int from boletim_disparo where enviado_em is not null), 0,
  'Coordenador não marca na Contorno');
update boletim_disparo set enviado_em = now() where obra_id = '00000000-0000-0000-0000-00000007b004';
select is((select count(*)::int from boletim_disparo
  where obra_id = '00000000-0000-0000-0000-00000007b004' and enviado_em is not null), 1,
  'gestor da Contorno marca como hoje');

select * from finish();
rollback;
