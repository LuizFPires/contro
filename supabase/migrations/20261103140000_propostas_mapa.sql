create extension if not exists unaccent with schema extensions;

create or replace function public.contro_chave_prestador(p_nome text)
returns text language sql stable set search_path = '' as $$
  select lower(extensions.unaccent(regexp_replace(trim(p_nome), '\s+', ' ', 'g')));
$$;

-- Inclui também nomes anteriores ao autocomplete.
insert into public.sugestao(tipo, texto)
select distinct 'prestador', trim(prestador) from public.obra_atividade
where nullif(trim(prestador), '') is not null
on conflict (tipo, texto) do nothing;

create or replace function public.contro_nome_prestador(p_nome text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_chave text := public.contro_chave_prestador(p_nome);
begin
  if not public.contro_e_membro() then raise exception 'Apenas membros' using errcode = '42501'; end if;
  if nullif(v_chave, '') is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_chave, 7351));
  select texto into v_nome from public.sugestao
    where tipo = 'prestador' and public.contro_chave_prestador(texto) = v_chave
    order by created_at, texto limit 1;
  if v_nome is null then
    v_nome := regexp_replace(trim(p_nome), '\s+', ' ', 'g');
    insert into public.sugestao(tipo, texto) values ('prestador', v_nome)
    on conflict (tipo, texto) do nothing;
  end if;
  return v_nome;
end;
$$;

create or replace function public.contro_normalizar_prestador_atividade()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.prestador := public.contro_nome_prestador(new.prestador);
  return new;
end;
$$;
create trigger obra_atividade_nome_prestador
before insert or update of prestador on public.obra_atividade
for each row when (new.prestador is not null)
execute function public.contro_normalizar_prestador_atividade();

create table public.mapa_proposta (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obra(id),
  atividade_id uuid not null references public.obra_atividade(id),
  contratado text not null check (length(trim(contratado)) between 1 and 200),
  descricao text not null check (length(trim(descricao)) between 1 and 2000),
  prazo date,
  recebida boolean not null default false,
  solucionada_por_contratacao boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  criado_por uuid not null default auth.uid() references auth.users(id)
);
create index on public.mapa_proposta(obra_id, atividade_id);
alter table public.mapa_proposta enable row level security;
create policy mapa_proposta_sel on public.mapa_proposta for select to authenticated using (public.contro_e_membro());
create policy mapa_proposta_ins on public.mapa_proposta for insert to authenticated with check (public.contro_e_membro() and criado_por = auth.uid());
create policy mapa_proposta_upd on public.mapa_proposta for update to authenticated using (public.contro_e_membro()) with check (public.contro_e_membro());
grant select, insert, update on public.mapa_proposta to authenticated;

create or replace function public.contro_validar_mapa_proposta()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from public.obra_atividade a where a.id = new.atividade_id
    and a.obra_id = new.obra_id and a.mapa_antecedencia_du is not null and a.deleted_at is null) then
    raise exception 'Selecione um mapa de cotação ativo da obra';
  end if;
  if tg_op = 'UPDATE' then
    new.criado_por := old.criado_por;
    new.created_at := old.created_at;
  end if;
  new.contratado := public.contro_nome_prestador(new.contratado);
  new.descricao := trim(new.descricao);
  return new;
end;
$$;
create trigger mapa_proposta_validar before insert or update on public.mapa_proposta
for each row execute function public.contro_validar_mapa_proposta();

create or replace function public.contro_solucionar_propostas_contratacao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.mapa_antecedencia_du is not null and nullif(trim(new.prestador), '') is not null then
    update public.mapa_proposta set recebida = true, solucionada_por_contratacao = true
    where atividade_id = new.id and not recebida and deleted_at is null;
  end if;
  return new;
end;
$$;
create trigger obra_atividade_solucionar_propostas
after update of prestador on public.obra_atividade
for each row execute function public.contro_solucionar_propostas_contratacao();
