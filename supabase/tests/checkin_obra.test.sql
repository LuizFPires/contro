-- Check-in por obra (pgTAP): ponto da obra no primeiro check-in, raio de 200 m,
-- sem localização, ajuste do relógio, ao menos uma foto da obra, validação e
-- frequência só pelo Gestor, e leitura só para quem vê a obra (RLS).
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000002c1', 'gestor@checkin.contro'),
  ('00000000-0000-0000-0000-0000000002c2', 'equipe@checkin.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000002c1', 'Gestor Check-in', 'gestor'),
  ('00000000-0000-0000-0000-0000000002c2', 'Equipe Check-in', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000002c1","role":"authenticated"}';
select gerar_obra(
  (select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02',
  'Obra Check-in',
  (select id from modelo where nome = 'Modelo 1 · CDC completo')
);
reset role;

create temp table o as select id from obra where nome = 'Obra Check-in';
insert into foto (id, obra_id, storage_path) values
  ('00000000-0000-0000-0000-00000000f001', (select id from o), 'x/1.jpg'),
  ('00000000-0000-0000-0000-00000000f002', (select id from o), 'x/2.jpg'),
  ('00000000-0000-0000-0000-00000000f003', (select id from o), 'x/3.jpg'),
  ('00000000-0000-0000-0000-00000000f004', (select id from o), 'x/4.jpg');
grant select on o to authenticated;

-- Equipe faz os check-ins
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000002c2","role":"authenticated"}';

select throws_ok(
  $$ select registrar_checkin('00000000-0000-0000-0000-0000000c0001', (select id from o), now(), now(),
       -19.97, -43.96, 10, null, '[]'::jsonb) $$,
  '22023', 'O check-in precisa de pelo menos uma foto',
  'sem foto não registra'
);
select lives_ok(
  $$ select registrar_checkin('00000000-0000-0000-0000-0000000c0001', (select id from o), now(), now(),
       -19.97, -43.96, 10, 'Abertura', '[{"foto_id":"00000000-0000-0000-0000-00000000f001","tirada_em":"2026-11-17T10:00:00Z","ordem":0}]'::jsonb) $$,
  'primeiro check-in registra'
);
select is(
  (select situacao from obra_checkin where id = '00000000-0000-0000-0000-0000000c0001'), 'ponto',
  'o primeiro check-in vira o ponto da obra'
);
select is(
  (select checkin_lat from obra where id = (select id from o)), -19.97::double precision,
  'obra guarda o ponto'
);
select lives_ok(
  $$ select registrar_checkin('00000000-0000-0000-0000-0000000c0002', (select id from o), now(), now(),
       -19.9710, -43.96, 10, null, '[{"foto_id":"00000000-0000-0000-0000-00000000f002","tirada_em":"2026-11-17T10:00:00Z","ordem":0}]'::jsonb) $$,
  'check-in perto do ponto'
);
select is(
  (select situacao from obra_checkin where id = '00000000-0000-0000-0000-0000000c0002'), 'na_obra',
  'a 111 m: na obra'
);
select lives_ok(
  $$ select registrar_checkin('00000000-0000-0000-0000-0000000c0003', (select id from o), now() - interval '1 hour',
       now() - interval '1 hour', -19.98, -43.96, 10, null,
       '[{"foto_id":"00000000-0000-0000-0000-00000000f003","tirada_em":"2026-11-17T10:00:00Z","ordem":0}]'::jsonb) $$,
  'check-in longe, com relógio do aparelho 1 h atrasado'
);
select is(
  (select situacao || ' ' || distancia_m from obra_checkin where id = '00000000-0000-0000-0000-0000000c0003'),
  'fora 1112',
  'a 1.112 m: fora da obra'
);
select ok(
  (select ajuste_relogio_s between 3590 and 3610 and feito_em > now() - interval '1 minute'
   from obra_checkin where id = '00000000-0000-0000-0000-0000000c0003'),
  'a hora é ajustada ao relógio do servidor'
);
select lives_ok(
  $$ select registrar_checkin('00000000-0000-0000-0000-0000000c0004', (select id from o), now(), now(),
       null, null, null, null, '[{"foto_id":"00000000-0000-0000-0000-00000000f004","tirada_em":"2026-11-17T10:00:00Z","ordem":0}]'::jsonb) $$,
  'check-in sem localização'
);
select is(
  (select situacao from obra_checkin where id = '00000000-0000-0000-0000-0000000c0004'), 'sem_local',
  'sem localização aguarda o Gestor'
);
select throws_ok(
  $$ select validar_checkin('00000000-0000-0000-0000-0000000c0003', true) $$,
  '42501', 'Só o Gestor valida check-in',
  'a Equipe não valida'
);
select throws_ok(
  $$ select definir_frequencia_checkin((select id from o), (select id from pessoa where nome = 'Equipe Check-in'), 'diario') $$,
  '42501', 'Só o Gestor define a frequência',
  'a Equipe não define frequência'
);

-- Gestor valida e define a frequência
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000002c1","role":"authenticated"}';
select lives_ok(
  $$ select validar_checkin('00000000-0000-0000-0000-0000000c0003', true) $$,
  'o Gestor valida o check-in fora da obra'
);
select lives_ok(
  $$ select definir_frequencia_checkin((select id from o), (select id from pessoa where nome = 'Equipe Check-in'), '2') $$,
  'o Gestor define a frequência'
);
reset role;

-- RLS: quem não vê a obra não lê os check-ins
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000002c3', 'sem@checkin.contro');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000002c3","role":"authenticated"}';
select is(
  (select count(*)::int from obra_checkin where obra_id = (select id from o)), 0,
  'sem acesso à obra não vê check-ins'
);

select * from finish();
rollback;
