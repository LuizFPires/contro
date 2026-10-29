-- Reunião e avisos (pedido do usuário, 28/10/2026): o gestor escolhe o dia e o
-- horário da reunião semanal e os avisos por push (lembrete da reunião de manhã
-- e antes de começar; resumo da manhã; tarefas que vencem hoje; providências
-- para começar hoje). Configuração global (linha única, só gestor edita).
-- gerar_avisos() roda no pg_cron a cada 5 min, no fuso de São Paulo, e grava um
-- aviso_disparo por pessoa; a Edge Function enviar-avisos manda o push e marca.

create table config_avisos (
  id boolean primary key default true check (id),
  reuniao_dia smallint not null default 1 check (reuniao_dia between 1 and 5),
  reuniao_hora time not null default '16:00',
  manha_ativo boolean not null default true,
  manha_hora time not null default '08:00',
  antes_ativo boolean not null default true,
  antes_min smallint not null default 60 check (antes_min in (30, 60, 120)),
  resumo_ativo boolean not null default true,
  resumo_hora time not null default '07:30',
  resumo_para text not null default 'todos' check (resumo_para in ('todos', 'gestores')),
  tarefas_ativo boolean not null default true,
  tarefas_hora time not null default '08:00',
  provid_ativo boolean not null default false,
  provid_hora time not null default '08:00',
  provid_para text not null default 'gestores' check (provid_para in ('todos', 'gestores')),
  updated_at timestamptz not null default now(),
  updated_by uuid references pessoa (id)
);
create trigger config_avisos_set_updated_at before update on config_avisos
  for each row execute function set_updated_at();
insert into config_avisos (id) values (true) on conflict (id) do nothing;

alter table config_avisos enable row level security;
-- Membro lê (a tela da reunião e o cartão da tela inicial usam dia e horário);
-- só o gestor edita. Sem insert/delete pela app: a linha única nasce aqui.
create policy config_avisos_sel on config_avisos for select to authenticated
  using (contro_e_membro());
create policy config_avisos_upd on config_avisos for update to authenticated
  using (contro_perfil() = 'gestor')
  with check (contro_perfil() = 'gestor');

-- Um aviso por pessoa, por tipo e por dia (dedup: o cron roda várias vezes).
create table aviso_disparo (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('reuniao_manha', 'reuniao_antes', 'resumo', 'tarefas', 'providencias')),
  dia date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  corpo text not null,
  url text not null default '/',
  criado_em timestamptz not null default now(),
  notificado_em timestamptz,
  unique (tipo, dia, user_id)
);
create index aviso_disparo_pendente_idx on aviso_disparo (criado_em) where notificado_em is null;
-- Só a Edge Function (service role) lê e marca; nenhum acesso pela app.
alter table aviso_disparo enable row level security;

-- "16h" / "16h30" para os textos (espelha horaCurta do core).
create or replace function public.contro_hora_curta(p_hora time)
returns text
language sql
immutable
set search_path = ''
as $$
  select extract(hour from p_hora)::int || 'h'
    || case when extract(minute from p_hora) = 0 then ''
            else lpad(extract(minute from p_hora)::int::text, 2, '0') end;
$$;

-- Gera os avisos do momento. Cada aviso só sai dentro de uma janela de 3 h depois
-- do horário (o cron que falhar não manda aviso velho de manhã à noite).
create or replace function gerar_avisos(p_agora timestamptz default now())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.config_avisos;
  v_hoje date := (p_agora at time zone 'America/Sao_Paulo')::date;
  v_hora time := (p_agora at time zone 'America/Sao_Paulo')::time;
  v_dow int := extract(isodow from (p_agora at time zone 'America/Sao_Paulo'));
  v_obras int;
  v_atrasadas int;
  v_antes time;
  v_n int := 0;
  v_k int;
begin
  select * into c from public.config_avisos where id;
  if not found then return 0; end if;
  select count(*) into v_obras from public.obra where status = 'ativa' and deleted_at is null;

  -- Lembretes da reunião (para todos), só no dia dela.
  if v_dow = c.reuniao_dia then
    if c.manha_ativo and v_hora >= c.manha_hora and v_hora < c.manha_hora + interval '3 hours'
       and c.manha_hora < c.reuniao_hora then
      insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
      select 'reuniao_manha', v_hoje, p.user_id, 'CONTRO · Reunião',
        'Reunião hoje às ' || public.contro_hora_curta(c.reuniao_hora) || '. '
          || v_obras || case when v_obras = 1 then ' obra' else ' obras' end
          || ' na pauta. Prepare as providências da semana.',
        '/?ir=reuniao'
      from public.pessoa p
      where p.ativo and p.deleted_at is null and p.user_id is not null
      on conflict (tipo, dia, user_id) do nothing;
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end if;
    v_antes := c.reuniao_hora - make_interval(mins => c.antes_min);
    if c.antes_ativo and v_hora >= v_antes and v_hora < c.reuniao_hora then
      insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
      select 'reuniao_antes', v_hoje, p.user_id, 'CONTRO · Reunião',
        'Começa em ' || case c.antes_min when 30 then '30 min' when 60 then '1 hora' else '2 horas' end
          || ' (' || public.contro_hora_curta(c.reuniao_hora) || '). Toque para abrir a pauta.',
        '/?ir=reuniao'
      from public.pessoa p
      where p.ativo and p.deleted_at is null and p.user_id is not null
      on conflict (tipo, dia, user_id) do nothing;
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end if;
  end if;

  -- Avisos do dia: segunda a sexta.
  if v_dow between 1 and 5 then
    if c.resumo_ativo and v_hora >= c.resumo_hora and v_hora < c.resumo_hora + interval '3 hours' then
      select count(*) into v_atrasadas from public.tarefa t join public.obra o on o.id = t.obra_id
      where t.status = 'aberta' and t.deleted_at is null and t.prazo < v_hoje
        and o.status = 'ativa' and o.deleted_at is null;
      insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
      select 'resumo', v_hoje, p.user_id, 'CONTRO · Bom dia',
        v_obras || case when v_obras = 1 then ' obra em andamento' else ' obras em andamento' end
          || case when v_atrasadas > 0
               then ' e ' || v_atrasadas || case when v_atrasadas = 1 then ' tarefa atrasada' else ' tarefas atrasadas' end
               else '' end
          || '. Veja o que está atrasado e o que fazer hoje.',
        '/?ir=hoje'
      from public.pessoa p
      where p.ativo and p.deleted_at is null and p.user_id is not null
        and (c.resumo_para = 'todos' or p.perfil = 'gestor')
      on conflict (tipo, dia, user_id) do nothing;
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end if;

    -- Tarefas que vencem hoje: cada responsável recebe só as suas.
    if c.tarefas_ativo and v_hora >= c.tarefas_hora and v_hora < c.tarefas_hora + interval '3 hours' then
      insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
      select 'tarefas', v_hoje, p.user_id, 'CONTRO · Tarefas',
        case when count(*) = 1 then 'Você tem 1 tarefa para hoje: ' || min(t.texto)
             else 'Você tem ' || count(*) || ' tarefas para hoje: ' || min(t.texto) || ' e mais '
                  || (count(*) - 1) end,
        '/?ir=tarefas'
      from public.tarefa t
      join public.obra o on o.id = t.obra_id and o.status = 'ativa' and o.deleted_at is null
      join public.pessoa p on p.id = t.responsavel_id
      where t.status = 'aberta' and t.deleted_at is null and t.prazo = v_hoje
        and p.ativo and p.deleted_at is null and p.user_id is not null
      group by p.user_id
      on conflict (tipo, dia, user_id) do nothing;
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end if;

    if c.provid_ativo and v_hora >= c.provid_hora and v_hora < c.provid_hora + interval '3 hours' then
      insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
      select 'providencias', v_hoje, p.user_id, 'CONTRO · Providências',
        'Confira o que contratar, alugar ou comprar a partir de hoje.',
        '/?ir=hoje'
      from public.pessoa p
      where p.ativo and p.deleted_at is null and p.user_id is not null
        and (c.provid_para = 'todos' or p.perfil = 'gestor')
      on conflict (tipo, dia, user_id) do nothing;
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end if;
  end if;

  return v_n;
end;
$$;

revoke execute on function gerar_avisos(timestamptz) from public, anon, authenticated;

-- A pauta nasce com o horário configurado (antes sempre 16:00).
create or replace function abrir_reuniao(p_data date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid; v_status text;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  -- Idempotente e à prova de corrida (dois membros abrindo a tela ao mesmo tempo).
  insert into public.reuniao (data, hora)
  values (p_data, coalesce((select reuniao_hora from public.config_avisos where id), '16:00'))
  on conflict (data) do nothing;
  select id, status into v_id, v_status from public.reuniao where data = p_data for update;
  -- Só completa a pauta enquanto a reunião não está fechada (não muta a ata histórica).
  if v_status <> 'fechada' then
    insert into public.reuniao_obra (reuniao_id, obra_id)
    select v_id, o.id from public.obra o where o.status = 'ativa' and o.deleted_at is null
    on conflict (reuniao_id, obra_id) do nothing;
  end if;
  return v_id;
end;
$$;

-- Cron: o fixo de segunda 15:30 (que falhava: o cron não é membro) sai; os avisos
-- são gerados a cada 5 min. A pauta já abre sob demanda pela tela.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'reuniao-abrir-pauta') then
      perform cron.unschedule('reuniao-abrir-pauta');
    end if;
    perform cron.schedule('avisos-gerar', '*/5 * * * *', 'select public.gerar_avisos();');
  end if;
end $$;
