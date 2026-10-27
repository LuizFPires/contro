-- Adicionar e excluir atividades na obra (pedido do usuário, 27/10/2026): a fase
-- da obra recebe ou perde cards livremente. Só na obra (o modelo não muda).
-- Exclusão é lógica (regra 7), com evento, e se desfaz. As dependências ficam
-- guardadas: o cliente liga as sucessoras às predecessoras da excluída (core).

create or replace function adicionar_atividade_obra(
  p_obra_id uuid,
  p_fase_id uuid,
  p_nome text,
  p_duracao_du int,
  p_predecessoras uuid[] default '{}',
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_pessoa uuid;
  v_ordem int;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not exists (select 1 from public.obra_fase where id = p_fase_id and obra_id = p_obra_id) then
    raise exception 'Fase não é desta obra' using errcode = '23503';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome da atividade' using errcode = '22023';
  end if;
  if p_duracao_du is null or p_duracao_du < 1 then
    raise exception 'Prazo mínimo de 1 dia útil' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_predecessoras) p(id)
    where not exists (
      select 1 from public.obra_atividade a
      where a.id = p.id and a.obra_id = p_obra_id and a.deleted_at is null and a.pai_id is null
    )
  ) then
    raise exception 'Predecessora não é desta obra' using errcode = '23503';
  end if;
  -- Repetição da mesma op (offline): devolve a que já existe.
  if exists (select 1 from public.obra_atividade where id = v_id) then
    return v_id;
  end if;

  select coalesce(max(ordem), 0) + 1 into v_ordem
  from public.obra_atividade where obra_id = p_obra_id and fase_id = p_fase_id and pai_id is null;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;

  insert into public.obra_atividade (id, obra_id, fase_id, ordem, nome, duracao_du, em_sequencia)
  values (v_id, p_obra_id, p_fase_id, v_ordem, trim(p_nome), p_duracao_du, true);
  insert into public.obra_dependencia (obra_id, atividade_id, predecessora_id)
  select p_obra_id, v_id, p.id from (select distinct unnest(p_predecessoras) as id) p;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (v_id, 'criada', v_pessoa, jsonb_build_object('nome', trim(p_nome), 'duracao_du', p_duracao_du));
  return v_id;
end;
$$;

create or replace function excluir_atividade_obra(p_atividade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_subs uuid[];
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.obra_atividade where id = p_atividade_id and pai_id is null and deleted_at is null
  ) then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  -- Subitens abertos saem junto; o evento guarda quais, para o Desfazer trazer de volta.
  select coalesce(array_agg(id), '{}') into v_subs
  from public.obra_atividade where pai_id = p_atividade_id and deleted_at is null;
  update public.obra_atividade set deleted_at = now()
  where id = p_atividade_id or id = any(v_subs);
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (p_atividade_id, 'excluida', v_pessoa, jsonb_build_object('subitens', to_jsonb(v_subs)));
end;
$$;

create or replace function restaurar_atividade_obra(p_atividade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_subs jsonb;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.obra_atividade where id = p_atividade_id and pai_id is null and deleted_at is not null
  ) then
    raise exception 'Atividade não está excluída' using errcode = '23503';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  select depois -> 'subitens' into v_subs from public.obra_atividade_evento
  where atividade_id = p_atividade_id and tipo = 'excluida' order by em desc limit 1;
  update public.obra_atividade set deleted_at = null
  where id = p_atividade_id
     or id in (select (jsonb_array_elements_text(coalesce(v_subs, '[]'::jsonb)))::uuid);
  insert into public.obra_atividade_evento (atividade_id, tipo, por)
  values (p_atividade_id, 'restaurada', v_pessoa);
end;
$$;

revoke execute on function adicionar_atividade_obra(uuid, uuid, text, int, uuid[], uuid) from public, anon;
revoke execute on function excluir_atividade_obra(uuid) from public, anon;
revoke execute on function restaurar_atividade_obra(uuid) from public, anon;
grant execute on function adicionar_atividade_obra(uuid, uuid, text, int, uuid[], uuid) to authenticated;
grant execute on function excluir_atividade_obra(uuid) to authenticated;
grant execute on function restaurar_atividade_obra(uuid) to authenticated;
