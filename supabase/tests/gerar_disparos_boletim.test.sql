-- Geração agendada do boletim (pgTAP). Roda com: supabase test db
-- Horário no fuso America/Sao_Paulo (UTC-3). Datas: 2026-01-05 é segunda.

begin;
select plan(6);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.boletim_disparo'::regclass),
  'RLS em boletim_disparo'
);

-- Fixtures: uma obra ativa (deve gerar), uma concluída e uma excluída (não devem).
insert into unidade (id, nome) values ('00000000-0000-0000-0000-00000000c001', 'U');
insert into obra (id, unidade_id, nome, inicio, modelo_rotulo, status) values
  ('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-00000000c001', 'Ativa', '2026-01-01', 'M', 'ativa'),
  ('00000000-0000-0000-0000-00000000c0a2', '00000000-0000-0000-0000-00000000c001', 'Concluída', '2026-01-01', 'M', 'concluida');
insert into obra (id, unidade_id, nome, inicio, modelo_rotulo, status, deleted_at) values
  ('00000000-0000-0000-0000-00000000c0a3', '00000000-0000-0000-0000-00000000c001', 'Excluída', '2026-01-01', 'M', 'ativa', now());

-- Config: principal segunda 06:30, fechamento desligado.
update config_boletim
  set ativo = true, dia_semana = 1, hora = '06:30', fechamento_ativo = false
  where id;

-- Quarta 10:00 BRT → não é segunda → nada.
do $$ begin perform gerar_disparos_boletim('2026-01-07 13:00:00+00'); end $$;
select is((select count(*)::int from boletim_disparo), 0, 'quarta não gera');

-- Segunda 06:35 BRT → gera 1 (só a obra ativa).
do $$ begin perform gerar_disparos_boletim('2026-01-05 09:35:00+00'); end $$;
select is(
  (select count(*)::int from boletim_disparo where edicao = 'principal'),
  1,
  'segunda após a hora gera 1 (só obra ativa)'
);

-- De novo, mais tarde → dedup por (obra, semana, edição).
do $$ begin perform gerar_disparos_boletim('2026-01-05 09:50:00+00'); end $$;
select is((select count(*)::int from boletim_disparo), 1, 'dedup por semana/edição');

-- Segunda 05:59 BRT da semana seguinte → antes da hora, não gera.
do $$ begin perform gerar_disparos_boletim('2026-01-12 08:59:00+00'); end $$;
select is(
  (select count(*)::int from boletim_disparo where semana_inicio = '2026-01-12'),
  0,
  'antes da hora não gera'
);

-- Fechamento ligado: sexta 17:05 BRT → gera a edição de fechamento.
update config_boletim set fechamento_ativo = true, fechamento_dia = 5, fechamento_hora = '17:00' where id;
do $$ begin perform gerar_disparos_boletim('2026-01-09 20:05:00+00'); end $$;
select is(
  (select count(*)::int from boletim_disparo where edicao = 'fechamento'),
  1,
  'fechamento na sexta gera'
);

select * from finish();
rollback;
