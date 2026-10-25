-- M4 · Pendências (qualidade): apontar com foto, resolver com antes/depois,
-- adiar/trazer, vistoriar (regra 5: vistoriador ≠ quem resolveu). Nada se apaga
-- de fato: exclusão lógica + pendencia_evento (regra 7).
--
-- SEGURANÇA: ao contrário das tabelas obra_* (que têm policy de UPDATE aberta a
-- membros), pendencia NÃO tem policy de escrita para authenticated. Todas as
-- transições de estado passam por RPCs SECURITY DEFINER, para que a regra 5 e as
-- mudanças de status não possam ser burladas por UPDATE direto do cliente.

create table pendencia (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obra (id) on delete cascade,
  atividade_id uuid references obra_atividade (id),
  titulo text not null,
  local text,
  criticidade text not null default 'media' check (criticidade in ('alta', 'media', 'baixa')),
  foto_antes_id uuid references foto (id),
  apontada_por uuid references pessoa (id),
  apontada_em timestamptz not null default now(),
  status text not null default 'aberta' check (status in ('aberta', 'em_vistoria', 'fechada')),
  ordem_fila numeric not null default 0,
  adiada_ate date,
  motivo_adiamento text,
  foto_depois_id uuid references foto (id),
  resolvida_por uuid references pessoa (id),
  resolvida_em timestamptz,
  vistoriada_por uuid references pessoa (id),
  vistoriada_em timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on pendencia (obra_id, status);
create index on pendencia (obra_id, ordem_fila);
create trigger pendencia_set_updated_at before update on pendencia
  for each row execute function set_updated_at();

create table pendencia_evento (
  id uuid primary key default gen_random_uuid(),
  pendencia_id uuid not null references pendencia (id) on delete cascade,
  tipo text not null, -- 'apontada' | 'adiada' | 'trazida' | 'resolvida' | 'aprovada' | 'reaberta'
  por uuid references pessoa (id),
  em timestamptz not null default now(),
  dados jsonb
);
create index on pendencia_evento (pendencia_id, em);

-- RLS: membro ativo LÊ; escrita só pelas RPCs (SECURITY DEFINER).
alter table pendencia enable row level security;
alter table pendencia_evento enable row level security;
create policy pendencia_sel on pendencia
  for select to authenticated using (obdc_e_membro());
create policy pendencia_evento_sel on pendencia_evento
  for select to authenticated using (obdc_e_membro());

-- Helper interno: pessoa ativa do auth.uid() (ou erro).
create or replace function public.obdc_pessoa_atual()
returns uuid
language sql
security definer
set search_path = ''
as $$
  select id from public.pessoa where user_id = auth.uid() and deleted_at is null;
$$;

-- Aponta uma pendência (foto primeiro). Entra na fila no topo (ordem_fila = min − 1).
create or replace function apontar_pendencia(
  p_obra_id uuid,
  p_titulo text,
  p_local text,
  p_criticidade text,
  p_foto_antes_id uuid,
  p_atividade_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_id uuid; v_topo numeric;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if p_foto_antes_id is null or not exists (
    select 1 from public.foto where id = p_foto_antes_id and obra_id = p_obra_id
  ) then
    raise exception 'Apontar exige foto da obra' using errcode = '23503';
  end if;
  if coalesce(trim(p_titulo), '') = '' then
    raise exception 'Título obrigatório' using errcode = '23514';
  end if;
  v_pessoa := public.obdc_pessoa_atual();
  select coalesce(min(ordem_fila), 0) - 1 into v_topo from public.pendencia where obra_id = p_obra_id;
  insert into public.pendencia (
    obra_id, atividade_id, titulo, local, criticidade, foto_antes_id,
    apontada_por, status, ordem_fila
  ) values (
    p_obra_id, p_atividade_id, p_titulo, p_local,
    coalesce(p_criticidade, 'media'), p_foto_antes_id, v_pessoa, 'aberta', v_topo
  ) returning id into v_id;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (v_id, 'apontada', v_pessoa, jsonb_build_object('foto_antes_id', p_foto_antes_id));
  return v_id;
end;
$$;

-- Resolve: foto de depois → em_vistoria (grava resolvida_por no servidor).
create or replace function resolver_pendencia(p_id uuid, p_foto_depois_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_obra uuid; v_status text;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select obra_id, status into v_obra, v_status
  from public.pendencia where id = p_id and deleted_at is null;
  if v_obra is null then
    raise exception 'Pendência inválida' using errcode = '23503';
  end if;
  if v_status <> 'aberta' then
    raise exception 'Só resolve pendência aberta' using errcode = '42501';
  end if;
  if p_foto_depois_id is null or not exists (
    select 1 from public.foto where id = p_foto_depois_id and obra_id = v_obra
  ) then
    raise exception 'Resolver exige foto de depois da obra' using errcode = '23503';
  end if;
  v_pessoa := public.obdc_pessoa_atual();
  update public.pendencia
  set status = 'em_vistoria', foto_depois_id = p_foto_depois_id,
      resolvida_por = v_pessoa, resolvida_em = now()
  where id = p_id;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (p_id, 'resolvida', v_pessoa, jsonb_build_object('foto_depois_id', p_foto_depois_id));
end;
$$;

-- Adia: sai da fila até a data escolhida (continua 'aberta').
create or replace function adiar_pendencia(p_id uuid, p_data date, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_status text;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select status into v_status from public.pendencia where id = p_id and deleted_at is null;
  if v_status is null then
    raise exception 'Pendência inválida' using errcode = '23503';
  end if;
  if v_status <> 'aberta' then
    raise exception 'Só adia pendência aberta' using errcode = '42501';
  end if;
  if p_data is null or p_data <= current_date then
    raise exception 'Data de retorno deve ser futura' using errcode = '23514';
  end if;
  v_pessoa := public.obdc_pessoa_atual();
  update public.pendencia
  set adiada_ate = p_data, motivo_adiamento = p_motivo
  where id = p_id;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (p_id, 'adiada', v_pessoa, jsonb_build_object('adiada_ate', p_data, 'motivo', p_motivo));
end;
$$;

-- Traz de volta à fila (topo), limpando o adiamento.
create or replace function trazer_pendencia(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_obra uuid; v_status text; v_topo numeric;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select obra_id, status into v_obra, v_status
  from public.pendencia where id = p_id and deleted_at is null;
  if v_obra is null then
    raise exception 'Pendência inválida' using errcode = '23503';
  end if;
  if v_status <> 'aberta' then
    raise exception 'Só traz pendência aberta' using errcode = '42501';
  end if;
  v_pessoa := public.obdc_pessoa_atual();
  select coalesce(min(ordem_fila), 0) - 1 into v_topo from public.pendencia where obra_id = v_obra;
  update public.pendencia
  set adiada_ate = null, motivo_adiamento = null, ordem_fila = v_topo
  where id = p_id;
  insert into public.pendencia_evento (pendencia_id, tipo, por)
  values (p_id, 'trazida', v_pessoa);
end;
$$;

-- Vistoria: aprovar fecha; reabrir volta à fila. REGRA 5: vistoriador ≠ resolvedor.
create or replace function vistoriar_pendencia(p_id uuid, p_aprovado boolean, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_obra uuid; v_status text; v_resolvida_por uuid; v_topo numeric;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select obra_id, status, resolvida_por into v_obra, v_status, v_resolvida_por
  from public.pendencia where id = p_id and deleted_at is null;
  if v_obra is null then
    raise exception 'Pendência inválida' using errcode = '23503';
  end if;
  if v_status <> 'em_vistoria' then
    raise exception 'Só vistoria pendência em vistoria' using errcode = '42501';
  end if;
  v_pessoa := public.obdc_pessoa_atual();
  if v_pessoa = v_resolvida_por then
    raise exception 'Quem resolveu não pode vistoriar a própria pendência' using errcode = '42501';
  end if;
  if p_aprovado then
    update public.pendencia
    set status = 'fechada', vistoriada_por = v_pessoa, vistoriada_em = now()
    where id = p_id;
    insert into public.pendencia_evento (pendencia_id, tipo, por)
    values (p_id, 'aprovada', v_pessoa);
  else
    select coalesce(min(ordem_fila), 0) - 1 into v_topo from public.pendencia where obra_id = v_obra;
    update public.pendencia
    set status = 'aberta', foto_depois_id = null, resolvida_por = null, resolvida_em = null,
        adiada_ate = null, ordem_fila = v_topo
    where id = p_id;
    insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
    values (p_id, 'reaberta', v_pessoa, jsonb_build_object('motivo', p_motivo));
  end if;
end;
$$;

-- Cron: devolve à fila as pendências adiadas vencidas (registra evento 'trazida').
-- A fila já as inclui por query (adiada_ate <= hoje); isto apenas normaliza e audita.
create or replace function pendencia_devolver_adiadas()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare r record; v_topo numeric;
begin
  for r in
    select id, obra_id from public.pendencia
    where status = 'aberta' and adiada_ate is not null and adiada_ate <= current_date
      and deleted_at is null
  loop
    select coalesce(min(ordem_fila), 0) - 1 into v_topo from public.pendencia where obra_id = r.obra_id;
    update public.pendencia set adiada_ate = null, ordem_fila = v_topo where id = r.id;
    insert into public.pendencia_evento (pendencia_id, tipo, dados)
    values (r.id, 'trazida', jsonb_build_object('auto', true));
  end loop;
end;
$$;

-- Nenhum cliente chama estas duas diretamente: a devolução roda só pelo pg_cron
-- (owner) e o helper de pessoa é usado dentro das RPCs (que rodam como owner).
revoke execute on function public.pendencia_devolver_adiadas() from public, anon, authenticated;
revoke execute on function public.obdc_pessoa_atual() from public, anon, authenticated;

-- Agenda no pg_cron (00:10) se a extensão estiver instalada. Sem ela, a fila já
-- cobre as vencidas pela query do cliente.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'pendencia-devolver-adiadas', '10 0 * * *',
      'select public.pendencia_devolver_adiadas();'
    );
  end if;
end $$;
