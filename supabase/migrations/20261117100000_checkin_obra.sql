-- Check-in por obra (17/11/2026, protótipo aprovado "CONTRO · Check-in por obra").
-- Cada pessoa registra a visita à obra com fotos tiradas pela câmera do app. A
-- data e a hora são do sistema (relógio do aparelho conferido com o do servidor
-- ao sincronizar) e a localização é gravada: o primeiro check-in da obra vira o
-- ponto da obra; mais de 200 m dele, ou sem localização, o Gestor valida. O
-- Gestor define a frequência esperada de cada pessoa por obra (Score: Presença).

alter table obra
  add column checkin_lat double precision,
  add column checkin_lng double precision,
  add column checkin_ponto_em timestamptz;

create table obra_checkin (
  id uuid primary key,
  obra_id uuid not null references obra (id) on delete cascade,
  pessoa_id uuid not null references pessoa (id),
  -- Hora do sistema no clique da primeira foto, já ajustada ao relógio do servidor.
  feito_em timestamptz not null,
  dia date not null,
  recebido_em timestamptz not null default now(),
  -- Diferença entre o servidor e o relógio do aparelho no envio (s; 0 se dentro da tolerância).
  ajuste_relogio_s integer not null default 0,
  -- Feito sem internet e enviado depois (mais de 5 min entre o clique e o envio).
  enviado_depois boolean not null default false,
  lat double precision,
  lng double precision,
  precisao_m real,
  situacao text not null check (situacao in ('ponto', 'na_obra', 'fora', 'sem_local')),
  distancia_m integer,
  observacao text check (observacao is null or length(observacao) <= 500),
  validacao text check (validacao in ('validado', 'nao_validado')),
  validado_por uuid references pessoa (id),
  validado_em timestamptz,
  deleted_at timestamptz
);
create index on obra_checkin (obra_id, dia);
create index on obra_checkin (pessoa_id, dia);

create table obra_checkin_foto (
  checkin_id uuid not null references obra_checkin (id) on delete cascade,
  foto_id uuid not null references foto (id),
  ordem smallint not null,
  tirada_em timestamptz not null,
  primary key (checkin_id, foto_id)
);

create table obra_checkin_frequencia (
  obra_id uuid not null references obra (id) on delete cascade,
  pessoa_id uuid not null references pessoa (id),
  desde date not null,
  frequencia text not null check (frequencia in ('diario', '3', '2', '1', 'nao')),
  definido_por uuid references pessoa (id),
  definido_em timestamptz not null default now(),
  primary key (obra_id, pessoa_id, desde)
);

-- Leitura: quem vê a obra. Escrita só pelas RPCs (security definer).
alter table obra_checkin enable row level security;
create policy obra_checkin_sel on obra_checkin for select to authenticated
  using (public.contro_ve_obra(obra_id));
grant select on obra_checkin to authenticated;

alter table obra_checkin_foto enable row level security;
create policy obra_checkin_foto_sel on obra_checkin_foto for select to authenticated
  using (exists (
    select 1 from public.obra_checkin c
    where c.id = checkin_id and public.contro_ve_obra(c.obra_id)
  ));
grant select on obra_checkin_foto to authenticated;

alter table obra_checkin_frequencia enable row level security;
create policy obra_checkin_frequencia_sel on obra_checkin_frequencia for select to authenticated
  using (public.contro_ve_obra(obra_id));
grant select on obra_checkin_frequencia to authenticated;

-- Distância em metros (haversine).
create or replace function contro_distancia_m(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
) returns integer
language sql
immutable
set search_path = ''
as $$
  select round(2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  ))))::integer;
$$;

-- Registra o check-in. p_feito_em: clique da 1ª foto no relógio do aparelho;
-- p_relogio: relógio do aparelho no envio (para ajustar a hora ao servidor).
-- p_fotos: [{foto_id, tirada_em, ordem}] (ao menos uma).
create or replace function registrar_checkin(
  p_id uuid,
  p_obra_id uuid,
  p_feito_em timestamptz,
  p_relogio timestamptz,
  p_lat double precision,
  p_lng double precision,
  p_precisao real,
  p_observacao text,
  p_fotos jsonb,
  p_client_op_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_skew integer;
  v_ajuste integer := 0;
  v_feito timestamptz;
  v_obra record;
  v_situacao text;
  v_dist integer;
  v_n integer;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_ve_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if jsonb_typeof(p_fotos) is distinct from 'array' or jsonb_array_length(p_fotos) = 0 then
    raise exception 'O check-in precisa de pelo menos uma foto' using errcode = '22023';
  end if;
  if jsonb_array_length(p_fotos) > 10 then
    raise exception 'Fotos demais' using errcode = '22023';
  end if;
  if (p_lat is null) <> (p_lng is null)
     or (p_lat is not null and (abs(p_lat) > 90 or abs(p_lng) > 180)) then
    raise exception 'Localização inválida' using errcode = '22023';
  end if;
  select count(*) into v_n
  from jsonb_array_elements(p_fotos) f
  join public.foto ft on ft.id = (f->>'foto_id')::uuid and ft.obra_id = p_obra_id;
  if v_n <> jsonb_array_length(p_fotos) then
    raise exception 'Foto não é desta obra' using errcode = '23503';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;
  if exists (select 1 from public.obra_checkin where id = p_id) then
    return; -- reenvio do mesmo check-in
  end if;

  v_pessoa := public.contro_pessoa_atual();
  -- Relógio do aparelho x servidor: fora da tolerância (2 min), a hora é ajustada.
  v_skew := extract(epoch from (now() - coalesce(p_relogio, now())))::integer;
  if abs(v_skew) > 120 then
    v_ajuste := v_skew;
  end if;
  v_feito := least(p_feito_em + make_interval(secs => v_ajuste), now());

  -- Ponto da obra: o primeiro check-in com localização.
  select id, checkin_lat, checkin_lng into v_obra
  from public.obra where id = p_obra_id for update;
  if p_lat is null then
    v_situacao := 'sem_local';
  elsif v_obra.checkin_lat is null then
    update public.obra
    set checkin_lat = p_lat, checkin_lng = p_lng, checkin_ponto_em = now()
    where id = p_obra_id;
    v_situacao := 'ponto';
    v_dist := 0;
  else
    v_dist := public.contro_distancia_m(v_obra.checkin_lat, v_obra.checkin_lng, p_lat, p_lng);
    v_situacao := case when v_dist > 200 then 'fora' else 'na_obra' end;
  end if;

  insert into public.obra_checkin (
    id, obra_id, pessoa_id, feito_em, dia, ajuste_relogio_s, enviado_depois,
    lat, lng, precisao_m, situacao, distancia_m, observacao
  ) values (
    p_id, p_obra_id, v_pessoa, v_feito, (v_feito at time zone 'America/Sao_Paulo')::date, v_ajuste,
    coalesce(p_relogio, now()) - p_feito_em > interval '5 minutes',
    p_lat, p_lng, p_precisao, v_situacao, v_dist, nullif(btrim(p_observacao), '')
  );
  insert into public.obra_checkin_foto (checkin_id, foto_id, ordem, tirada_em)
  select p_id, (f->>'foto_id')::uuid, coalesce((f->>'ordem')::smallint, 0),
         least((f->>'tirada_em')::timestamptz + make_interval(secs => v_ajuste), now())
  from jsonb_array_elements(p_fotos) f;
  -- A foto guarda a hora e o local do check-in.
  update public.foto ft
  set tirada_em = cf.tirada_em, lat = p_lat, lng = p_lng, tirada_por = v_pessoa
  from public.obra_checkin_foto cf
  where cf.checkin_id = p_id and ft.id = cf.foto_id;
end;
$$;
revoke execute on function registrar_checkin(uuid, uuid, timestamptz, timestamptz, double precision, double precision, real, text, jsonb, uuid) from public, anon;
grant execute on function registrar_checkin(uuid, uuid, timestamptz, timestamptz, double precision, double precision, real, text, jsonb, uuid) to authenticated;

-- O Gestor valida (ou não) o check-in fora da obra ou sem localização.
create or replace function validar_checkin(
  p_id uuid,
  p_valido boolean,
  p_client_op_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c record;
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o Gestor valida check-in' using errcode = '42501';
  end if;
  select id, obra_id, situacao into v_c
  from public.obra_checkin where id = p_id and deleted_at is null for update;
  if not found or not public.contro_ve_obra(v_c.obra_id) then
    raise exception 'Check-in inválido' using errcode = '23503';
  end if;
  if v_c.situacao not in ('fora', 'sem_local') then
    raise exception 'Este check-in não precisa de validação' using errcode = '22023';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;
  update public.obra_checkin
  set validacao = case when p_valido then 'validado' else 'nao_validado' end,
      validado_por = public.contro_pessoa_atual(),
      validado_em = now()
  where id = p_id;
end;
$$;
revoke execute on function validar_checkin(uuid, boolean, uuid) from public, anon;
grant execute on function validar_checkin(uuid, boolean, uuid) to authenticated;

-- O Gestor define a frequência de check-in de uma pessoa nesta obra (vale a
-- partir de hoje; no mesmo dia, a última escolha vence).
create or replace function definir_frequencia_checkin(
  p_obra_id uuid,
  p_pessoa_id uuid,
  p_frequencia text,
  p_client_op_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o Gestor define a frequência' using errcode = '42501';
  end if;
  if not public.contro_ve_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if p_frequencia not in ('diario', '3', '2', '1', 'nao') then
    raise exception 'Frequência inválida' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pessoa where id = p_pessoa_id and deleted_at is null) then
    raise exception 'Pessoa inválida' using errcode = '23503';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;
  insert into public.obra_checkin_frequencia (obra_id, pessoa_id, desde, frequencia, definido_por)
  values (p_obra_id, p_pessoa_id, (now() at time zone 'America/Sao_Paulo')::date, p_frequencia,
          public.contro_pessoa_atual())
  on conflict (obra_id, pessoa_id, desde) do update
    set frequencia = excluded.frequencia,
        definido_por = excluded.definido_por,
        definido_em = now();
end;
$$;
revoke execute on function definir_frequencia_checkin(uuid, uuid, text, uuid) from public, anon;
grant execute on function definir_frequencia_checkin(uuid, uuid, text, uuid) to authenticated;
