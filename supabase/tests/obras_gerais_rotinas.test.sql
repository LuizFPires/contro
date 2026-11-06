-- Obras gerais: as rotinas globais (avisos push, boletim, pauta da reunião) só
-- olham obras e pessoas da Contorno.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'gestor@rot.contro'),
  ('00000000-0000-0000-0000-0000000000e2', 'geral@rot.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000e1', 'Rot Gestor', 'gestor'),
  ('00000000-0000-0000-0000-0000000000e2', 'Rot Geral', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set acesso_contorno = false, papel_geral = 'membro' where user_id = '00000000-0000-0000-0000-0000000000e2';
insert into push_subscription (user_id, endpoint, p256dh, auth) values
  ('00000000-0000-0000-0000-0000000000e2', 'https://fcm.googleapis.com/rot-geral', 'p', 'a');

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000000e001', 'Rot K', '2031-01-01', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000000e002', 'Rot G1', '2031-01-01', 'x', 'geral');
-- Só estas obras contam (isola de dados de outros testes).
update obra set status = 'pausada' where id not in
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000e002');
insert into tarefa (obra_id, texto, prazo) values
  ('00000000-0000-0000-0000-00000000e001', 'Tarefa K', '2031-01-07'),
  ('00000000-0000-0000-0000-00000000e002', 'Tarefa G1 atrasada', '2031-01-07'),
  ('00000000-0000-0000-0000-00000000e002', 'Tarefa G1 atrasada 2', '2031-01-06');

update config_avisos set reuniao_dia = 1, reuniao_hora = '16:00', manha_ativo = true, manha_hora = '08:00',
  antes_ativo = true, antes_min = 60, acoes_ativo = true, acoes_hora = '07:30',
  provid_ativo = true, provid_hora = '07:00', provid_para = 'todos' where id;

-- Quarta 08/01/2031 07:40: ações e providências.
select gerar_avisos('2031-01-08 07:40-03');
-- Segunda 06/01/2031 08:10 e 15:30: reunião (manhã e antes).
select gerar_avisos('2031-01-06 08:10-03');
select gerar_avisos('2031-01-06 15:30-03');

select is((select count(*)::int from aviso_disparo where user_id = '00000000-0000-0000-0000-0000000000e2'), 0,
  'pessoa só de obras gerais não recebe nenhum aviso');
select is((select corpo from aviso_disparo where tipo = 'acoes_equipe' and user_id = '00000000-0000-0000-0000-0000000000e1'
  and dia = '2031-01-08'), '1 atrasada.', 'Equipe hoje do gestor ignora as tarefas de obra geral');
select ok((select corpo like '%1 obra na pauta%' from aviso_disparo where tipo = 'reuniao_manha'
  and user_id = '00000000-0000-0000-0000-0000000000e1'), 'lembrete da reunião conta só obras da Contorno');
select is((select count(distinct tipo)::int from aviso_disparo where tipo in ('reuniao_antes', 'providencias')
  and user_id = '00000000-0000-0000-0000-0000000000e1'), 2, 'gestor da Contorno continua recebendo reunião e providências');

-- Boletim: só a obra da Contorno.
update config_boletim set ativo = true, dia_semana = 1, hora = '06:30', fechamento_ativo = true,
  fechamento_dia = 5, fechamento_hora = '17:00' where id;
select gerar_disparos_boletim('2031-01-06 09:35:00+00');
select gerar_disparos_boletim('2031-01-10 20:05:00+00');
select is((select count(*)::int from boletim_disparo where obra_id = '00000000-0000-0000-0000-00000000e002'), 0,
  'boletim não gera disparo para obra geral');
select is((select count(*)::int from boletim_disparo where obra_id = '00000000-0000-0000-0000-00000000e001'), 2,
  'boletim gera principal e fechamento para a obra da Contorno');

-- Pauta da reunião.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select lives_ok($$ select public.abrir_reuniao('2031-01-13') $$, 'gestor abre a reunião');
reset role;
select is((select count(*)::int from reuniao_obra ro join reuniao r on r.id = ro.reuniao_id
  where r.data = '2031-01-13' and ro.obra_id = '00000000-0000-0000-0000-00000000e002'), 0,
  'pauta não inclui obra geral');
select is((select count(*)::int from reuniao_obra ro join reuniao r on r.id = ro.reuniao_id
  where r.data = '2031-01-13' and ro.obra_id = '00000000-0000-0000-0000-00000000e001'), 1,
  'pauta inclui a obra da Contorno');

select * from finish();
rollback;
