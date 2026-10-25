-- M7 · Reunião semanal e ata. Uma reunião por data (segunda 16h), com uma linha
-- por obra (observações + snapshot do previsto×realizado ao fechar). Escrita por
-- RPC; fechar é só do gestor (SPEC §6). Cron de segunda 15:30 cria a pauta.

create table reuniao (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  hora time not null default '16:00',
  status text not null default 'pauta' check (status in ('pauta', 'em_andamento', 'fechada')),
  fechada_em timestamptz,
  fechada_por uuid references pessoa (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger reuniao_set_updated_at before update on reuniao
  for each row execute function set_updated_at();

create table reuniao_obra (
  reuniao_id uuid not null references reuniao (id) on delete cascade,
  obra_id uuid not null references obra (id) on delete cascade,
  observacoes text,
  snapshot jsonb,
  primary key (reuniao_id, obra_id)
);

alter table reuniao enable row level security;
alter table reuniao_obra enable row level security;
create policy reuniao_sel on reuniao for select to authenticated using (obdc_e_membro());
create policy reuniao_obra_sel on reuniao_obra for select to authenticated using (obdc_e_membro());

-- Abre (ou retorna) a pauta da data: cria a reunião e uma linha por obra ativa.
create or replace function abrir_reuniao(p_data date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select id into v_id from public.reuniao where data = p_data;
  if v_id is null then
    insert into public.reuniao (data) values (p_data) returning id into v_id;
    insert into public.reuniao_obra (reuniao_id, obra_id)
    select v_id, o.id from public.obra o where o.status = 'ativa' and o.deleted_at is null;
  end if;
  return v_id;
end;
$$;

-- Observações da obra na reunião (texto livre; qualquer membro).
create or replace function salvar_observacao_reuniao(
  p_reuniao_id uuid,
  p_obra_id uuid,
  p_texto text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text; v_n int;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  -- Trava a linha da reunião (fechar_reuniao também a trava no UPDATE), evitando
  -- a corrida entre checar o status e gravar.
  select status into v_status from public.reuniao where id = p_reuniao_id for update;
  if v_status is null then
    raise exception 'Reunião inválida' using errcode = '23503';
  end if;
  if v_status = 'fechada' then
    raise exception 'Reunião fechada' using errcode = '42501';
  end if;
  update public.reuniao_obra set observacoes = p_texto
  where reuniao_id = p_reuniao_id and obra_id = p_obra_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Obra não é desta reunião' using errcode = '23503';
  end if;
end;
$$;

-- Fecha a reunião (só gestor) e materializa o snapshot por obra (vindo do cliente).
create or replace function fechar_reuniao(p_id uuid, p_snapshots jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  if public.obdc_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor fecha a reunião' using errcode = '42501';
  end if;
  update public.reuniao
  set status = 'fechada', fechada_em = now(), fechada_por = public.obdc_pessoa_atual()
  where id = p_id and status <> 'fechada';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Reunião já fechada ou inválida' using errcode = '42501';
  end if;
  if p_snapshots is not null then
    update public.reuniao_obra ro
    set snapshot = s.snapshot
    from (
      select (x->>'obra_id')::uuid as obra_id, x->'snapshot' as snapshot
      from jsonb_array_elements(p_snapshots) x
    ) s
    where ro.reuniao_id = p_id and ro.obra_id = s.obra_id;
  end if;
end;
$$;

-- Cron: segunda 15:30 cria a pauta da reunião do dia (se pg_cron existir). A tela
-- também abre/cria a pauta sob demanda, então não depende do cron.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('reuniao-abrir-pauta', '30 15 * * 1', 'select public.abrir_reuniao(current_date);');
  end if;
end $$;
