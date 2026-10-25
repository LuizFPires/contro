-- M10 · Boletim automático — fatia 2: geração agendada.
-- No horário configurado (config_boletim), um "disparo" é criado por obra ativa.
-- O texto/snapshot do boletim é calculado no cliente (core) ao abrir; aqui só
-- marcamos "está na hora", com dedup por (obra, semana, edição). Esses disparos
-- alimentam a lista "prontos para enviar" e, na fatia 3, o push.
create type boletim_edicao as enum ('principal', 'fechamento');

create table boletim_disparo (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obra (id) on delete cascade,
  semana_inicio date not null, -- segunda da semana (fuso America/Sao_Paulo)
  edicao boletim_edicao not null,
  criado_em timestamptz not null default now(),
  notificado_em timestamptz, -- push enviado (fatia 3)
  enviado_em timestamptz, -- o gestor marcou como enviado no WhatsApp
  unique (obra_id, semana_inicio, edicao)
);

alter table boletim_disparo enable row level security;
-- Membro ativo lê; o gestor marca como enviado. A inserção é só da função (cron).
create policy boletim_disparo_sel on boletim_disparo for select to authenticated
  using (contro_e_membro());
create policy boletim_disparo_upd on boletim_disparo for update to authenticated
  using (contro_perfil() = 'gestor')
  with check (contro_perfil() = 'gestor');

-- Cria os disparos devidos em p_agora, conforme config_boletim, sem duplicar.
-- Horários no fuso America/Sao_Paulo (sem feriados; Brasil sem horário de verão).
-- Roda só pelo pg_cron (sem grant a authenticated).
create or replace function gerar_disparos_boletim(p_agora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.config_boletim%rowtype;
  v_local timestamp;
  v_isodow int;
  v_hora time;
  v_semana date;
  v_total int := 0;
  v_n int;
begin
  select * into c from public.config_boletim where id;
  if not found or not c.ativo then
    return 0;
  end if;

  v_local := p_agora at time zone 'America/Sao_Paulo';
  v_isodow := extract(isodow from v_local)::int;
  v_hora := v_local::time;
  v_semana := date_trunc('week', v_local)::date; -- segunda da semana

  -- Edição principal
  if v_isodow = c.dia_semana and v_hora >= c.hora then
    insert into public.boletim_disparo (obra_id, semana_inicio, edicao)
    select o.id, v_semana, 'principal'
    from public.obra o
    where o.status = 'ativa' and o.deleted_at is null
    on conflict (obra_id, semana_inicio, edicao) do nothing;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end if;

  -- Edição de fechamento (opcional)
  if c.fechamento_ativo and v_isodow = c.fechamento_dia and v_hora >= c.fechamento_hora then
    insert into public.boletim_disparo (obra_id, semana_inicio, edicao)
    select o.id, v_semana, 'fechamento'
    from public.obra o
    where o.status = 'ativa' and o.deleted_at is null
    on conflict (obra_id, semana_inicio, edicao) do nothing;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end if;

  return v_total;
end;
$$;

-- Só o dono (postgres, usado pelo pg_cron) executa. Revoga explicitamente de
-- public E dos papéis do Supabase (anon/authenticated recebem EXECUTE por
-- default privileges), senão um autenticado poderia forçar disparos fora do
-- horário passando um p_agora arbitrário.
revoke all on function public.gerar_disparos_boletim(timestamptz) from public, anon, authenticated;

-- Agenda no pg_cron (a cada 15 min) se a extensão existir. A função checa o
-- horário por dentro, então rodar com frequência é seguro e idempotente.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'boletim-gerar-disparos',
      '*/15 * * * *',
      'select public.gerar_disparos_boletim();'
    );
  end if;
end $$;
