-- Obras gerais · Etapa 4: reunião por obra geral. A reunião única da Contorno
-- continua igual (mesma linha, só obras Contorno); a da obra geral coexiste na
-- mesma data, abre para o participante, fecha e reabre só para quem planeja.
-- Requer o seed de homologação (unidades Contorno + Modelo 1).
begin;
select plan(43);

-- Elenco: G gestor Contorno, M equipe Contorno, C coordenador de OG,
-- J membro de OG, C2 coordenador de OG2 (não participa de OG).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000005c0d1', 'g@reun-geral.contro'),
  ('00000000-0000-0000-0000-00000005c0d2', 'm@reun-geral.contro'),
  ('00000000-0000-0000-0000-00000005c0d3', 'c@reun-geral.contro'),
  ('00000000-0000-0000-0000-00000005c0d4', 'j@reun-geral.contro'),
  ('00000000-0000-0000-0000-00000005c0d5', 'c2@reun-geral.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-00000005c0d1', 'Reun G', 'gestor'),
  ('00000000-0000-0000-0000-00000005c0d2', 'Reun M', 'equipe'),
  ('00000000-0000-0000-0000-00000005c0d3', 'Reun C', 'equipe'),
  ('00000000-0000-0000-0000-00000005c0d4', 'Reun J', 'equipe'),
  ('00000000-0000-0000-0000-00000005c0d5', 'Reun C2', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
update pessoa set acesso_contorno = false, papel_geral = 'coordenador'
  where user_id in ('00000000-0000-0000-0000-00000005c0d3', '00000000-0000-0000-0000-00000005c0d5');
update pessoa set acesso_contorno = false, papel_geral = 'membro'
  where user_id = '00000000-0000-0000-0000-00000005c0d4';

insert into obra (id, nome, inicio, modelo_rotulo, ambiente) values
  ('00000000-0000-0000-0000-00000005cf01', 'Reun K', '2032-03-01', 'x', 'contorno'),
  ('00000000-0000-0000-0000-00000005cf02', 'Reun OG', '2032-03-01', 'x', 'geral'),
  ('00000000-0000-0000-0000-00000005cf03', 'Reun OG2', '2032-03-01', 'x', 'geral');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000005cf02', id from pessoa
  where user_id in ('00000000-0000-0000-0000-00000005c0d3', '00000000-0000-0000-0000-00000005c0d4');
insert into obra_participante (obra_id, pessoa_id)
  select '00000000-0000-0000-0000-00000005cf03', id from pessoa
  where user_id = '00000000-0000-0000-0000-00000005c0d5';
update config_avisos set reuniao_hora = '15:30' where id;

-- Obras Contorno ativas (o que a pauta única deve trazer).
create temp table obras_k as
  select id from obra where status = 'ativa' and deleted_at is null and ambiente = 'contorno';
create temp table r (k text primary key, id uuid);
grant select on obras_k to authenticated;
grant all on r to authenticated;

set local role authenticated;

-- ---------- Contorno: a reunião única como hoje ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d2","role":"authenticated"}';
insert into r select 'k', abrir_reuniao('2032-03-01');
select is(abrir_reuniao('2032-03-01'), (select id from r where k = 'k'), 'Contorno: abrir de novo devolve a mesma reunião');
select is((select hora from reuniao where id = (select id from r where k = 'k')), '15:30'::time,
  'Contorno: hora da config global');
select is(
  (select array_agg(obra_id order by obra_id) from reuniao_obra where reuniao_id = (select id from r where k = 'k')),
  (select array_agg(id order by id) from obras_k),
  'Contorno: pauta com as obras Contorno ativas (sem obra geral)');

-- ---------- Obra geral: participante abre ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d4","role":"authenticated"}';
insert into r select 'g', abrir_reuniao_geral('00000000-0000-0000-0000-00000005cf02', '2032-03-01');
select isnt((select id from r where k = 'g'), (select id from r where k = 'k'),
  'reunião geral na mesma data é outra reunião');
select is(abrir_reuniao_geral('00000000-0000-0000-0000-00000005cf02', '2032-03-01'), (select id from r where k = 'g'),
  'segunda chamada de abrir_reuniao_geral devolve o mesmo id');
select is(
  (select row(obra_id, data, hora, status)::text from reuniao where id = (select id from r where k = 'g')),
  row('00000000-0000-0000-0000-00000005cf02'::uuid, '2032-03-01'::date, '15:30'::time, 'pauta')::text,
  'reunião geral: da obra, na data, hora global, em pauta');
select is(
  (select array_agg(obra_id) from reuniao_obra where reuniao_id = (select id from r where k = 'g')),
  array['00000000-0000-0000-0000-00000005cf02'::uuid],
  'reunião geral tem uma linha só, a da obra');
select throws_ok($$ select abrir_reuniao('2032-03-01') $$, '42501', null,
  'membro de obra geral não abre a reunião da Contorno');
select throws_ok($$ select abrir_reuniao_geral('00000000-0000-0000-0000-00000005cf01', '2032-03-01') $$, '23505', null,
  'abrir_reuniao_geral recusa obra Contorno');
select throws_ok($$ select abrir_reuniao_geral(gen_random_uuid(), '2032-03-01') $$, '23503', null,
  'abrir_reuniao_geral recusa obra inexistente');
select throws_ok($$ select abrir_reuniao_geral('00000000-0000-0000-0000-00000005cf03', '2032-03-01') $$, '42501', null,
  'J não abre reunião de obra em que não participa');

-- Contorno não mudou com a reunião geral na mesma data.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d2","role":"authenticated"}';
select is(abrir_reuniao('2032-03-01'), (select id from r where k = 'k'), 'Contorno: ainda a mesma reunião');
select is(
  (select array_agg(obra_id order by obra_id) from reuniao_obra where reuniao_id = (select id from r where k = 'k')),
  (select array_agg(id order by id) from obras_k),
  'Contorno: mesmas obras na pauta');
select throws_ok($$ select abrir_reuniao_geral('00000000-0000-0000-0000-00000005cf02', '2032-03-01') $$, '42501', null,
  'pessoa só da Contorno não abre reunião de obra geral');

-- ---------- Leitura: cada um vê só a sua ----------
select is((select count(*)::int from reuniao where id = (select id from r where k = 'k')), 1, 'M lê a reunião da Contorno');
select is((select count(*)::int from reuniao where id = (select id from r where k = 'g')), 0, 'M não lê a reunião geral');
select is((select count(*)::int from reuniao_obra where reuniao_id = (select id from r where k = 'g')), 0,
  'M não lê a linha da obra geral');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d4","role":"authenticated"}';
select is((select count(*)::int from reuniao where id = (select id from r where k = 'g')), 1, 'J lê a reunião geral');
select is((select count(*)::int from reuniao where id = (select id from r where k = 'k')), 0, 'J não lê a reunião da Contorno');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d5","role":"authenticated"}';
select is((select count(*)::int from reuniao where id = (select id from r where k = 'g')), 0,
  'C2 não lê a reunião de obra em que não participa');

-- ---------- Participante responde e observa ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d4","role":"authenticated"}';
select lives_ok(format($$ select responder_reuniao(%L, '00000000-0000-0000-0000-00000005cf02', 'semana_concluir',
  '00000000-0000-0000-0000-00000005ca01', 'segue') $$, (select id from r where k = 'g')),
  'J (membro) responde item da reunião geral');
select is((select resposta from reuniao_resposta where reuniao_id = (select id from r where k = 'g')
  and item_id = '00000000-0000-0000-0000-00000005ca01'), 'segue', 'resposta gravada e visível para J');
select lives_ok(format($$ select salvar_observacao_reuniao(%L, '00000000-0000-0000-0000-00000005cf02', 'Obs geral') $$,
  (select id from r where k = 'g')), 'J salva observação da obra geral');
select is((select observacoes from reuniao_obra where reuniao_id = (select id from r where k = 'g')), 'Obs geral',
  'observação gravada');
select throws_ok(format($$ select responder_reuniao(%L, '00000000-0000-0000-0000-00000005cf01', 'semana_concluir',
  '00000000-0000-0000-0000-00000005ca02', 'segue') $$, (select id from r where k = 'k')), '42501', null,
  'J não responde na reunião da Contorno');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d2","role":"authenticated"}';
select throws_ok(format($$ select responder_reuniao(%L, '00000000-0000-0000-0000-00000005cf02', 'semana_concluir',
  '00000000-0000-0000-0000-00000005ca01', 'acao') $$, (select id from r where k = 'g')), '42501', null,
  'M não responde na reunião geral');
select throws_ok(format($$ select salvar_observacao_reuniao(%L, '00000000-0000-0000-0000-00000005cf02', 'x') $$,
  (select id from r where k = 'g')), '42501', null, 'M não observa na reunião geral');
select lives_ok(format($$ select salvar_observacao_reuniao(%L, '00000000-0000-0000-0000-00000005cf01', 'Obs K') $$,
  (select id from r where k = 'k')), 'Contorno: M segue observando como hoje');

-- ---------- Fechar e reabrir: quem planeja ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d4","role":"authenticated"}';
select throws_ok(format($$ select fechar_reuniao_geral(%L, '{"a":1}') $$, (select id from r where k = 'g')), '42501', null,
  'Membro não fecha a reunião geral');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d1","role":"authenticated"}';
select throws_ok(format($$ select fechar_reuniao(%L) $$, (select id from r where k = 'g')), '42501', null,
  'gestor da Contorno não fecha a reunião geral por fechar_reuniao');
select throws_ok(format($$ select fechar_reuniao_geral(%L) $$, (select id from r where k = 'k')), '23505', null,
  'fechar_reuniao_geral recusa a reunião da Contorno');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d5","role":"authenticated"}';
select throws_ok(format($$ select fechar_reuniao_geral(%L) $$, (select id from r where k = 'g')), '42501', null,
  'coordenador de outra obra não fecha');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d3","role":"authenticated"}';
select lives_ok(format($$ select fechar_reuniao_geral(%L, '{"a":1}') $$, (select id from r where k = 'g')),
  'Coordenador fecha a reunião geral');
select is(
  (select row(r2.status, ro.snapshot)::text from reuniao r2 join reuniao_obra ro on ro.reuniao_id = r2.id
   where r2.id = (select id from r where k = 'g')),
  row('fechada', '{"a":1}'::jsonb)::text, 'fechada com o snapshot da obra');
select is(abrir_reuniao_geral('00000000-0000-0000-0000-00000005cf02', '2032-03-01'), (select id from r where k = 'g'),
  'abrir de novo após fechar devolve a mesma reunião');
select is((select status from reuniao where id = (select id from r where k = 'g')), 'fechada',
  'abrir não mexe em reunião fechada');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d4","role":"authenticated"}';
select throws_ok(format($$ select responder_reuniao(%L, '00000000-0000-0000-0000-00000005cf02', 'semana_concluir',
  '00000000-0000-0000-0000-00000005ca01', 'acao') $$, (select id from r where k = 'g')), '42501', null,
  'reunião geral fechada não aceita resposta');
select throws_ok(format($$ select reabrir_reuniao_geral(%L) $$, (select id from r where k = 'g')), '42501', null,
  'Membro não reabre');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d1","role":"authenticated"}';
select throws_ok(format($$ select reabrir_reuniao(%L) $$, (select id from r where k = 'g')), '42501', null,
  'gestor da Contorno não reabre a reunião geral por reabrir_reuniao');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d3","role":"authenticated"}';
select lives_ok(format($$ select reabrir_reuniao_geral(%L) $$, (select id from r where k = 'g')),
  'Coordenador reabre a reunião geral');
select is(
  (select row(r2.status, r2.fechada_em, (select count(*) from reuniao_obra ro where ro.reuniao_id = r2.id))::text
   from reuniao r2 where r2.id = (select id from r where k = 'g')),
  row('pauta', null::timestamptz, 1::bigint)::text, 'volta a pauta, só com a obra');
select throws_ok(format($$ select reabrir_reuniao_geral(%L) $$, (select id from r where k = 'g')), '42501', null,
  'reunião geral que não está fechada é recusada');

-- Contorno: o gestor fecha a reunião única como hoje.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000005c0d1","role":"authenticated"}';
select lives_ok(format($$ select fechar_reuniao(%L) $$, (select id from r where k = 'k')),
  'Contorno: gestor fecha a reunião única');
reset role;

select * from finish();
rollback;
