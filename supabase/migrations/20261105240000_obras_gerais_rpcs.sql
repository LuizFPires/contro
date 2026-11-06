-- Obras gerais · Etapa 1: criar obra geral, dar acesso (papel + obras) pelo
-- e-mail e convite consumido no cadastro. Só administrador chama as RPCs.

-- Validação comum de papel e obras (interna: só as RPCs abaixo usam).
create or replace function contro_valida_acesso_geral(p_papel text, p_obra_ids uuid[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_papel is null or p_papel not in ('coordenador','membro') then
    raise exception 'papel inválido' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_obra_ids, '{}'::uuid[])) as i(id)
    where i.id is null or not exists (
      select 1 from public.obra o
      where o.id = i.id and o.ambiente = 'geral' and o.deleted_at is null
    )
  ) then
    raise exception 'obra inválida: só obras gerais' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function contro_valida_acesso_geral(text, uuid[]) from public, anon, authenticated;

-- Troca as participações da pessoa pela lista (interna).
create or replace function contro_troca_participacoes(p_pessoa_id uuid, p_obra_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.obra_participante where pessoa_id = p_pessoa_id;
  insert into public.obra_participante (obra_id, pessoa_id, created_by)
  select distinct i.id, p_pessoa_id, auth.uid()
  from unnest(coalesce(p_obra_ids, '{}'::uuid[])) as i(id);
end;
$$;
revoke execute on function contro_troca_participacoes(uuid, uuid[]) from public, anon, authenticated;

create or replace function criar_obra_geral(p_nome text, p_cidade text, p_id uuid default gen_random_uuid())
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_cidade text := nullif(btrim(coalesce(p_cidade, '')), '');
begin
  if not public.contro_e_admin() then
    raise exception 'só administrador cria obra geral' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'id da obra obrigatório' using errcode = '22023';
  end if;
  if exists (select 1 from public.obra where id = p_id) then
    -- Idempotente (fila offline reenviando), mas só para a própria obra geral viva.
    if exists (select 1 from public.obra
               where id = p_id and ambiente = 'geral' and deleted_at is null) then
      return p_id;
    end if;
    raise exception 'já existe outra obra com esse id' using errcode = '23505';
  end if;
  if char_length(v_nome) < 1 or char_length(v_nome) > 80 then
    raise exception 'nome da obra deve ter de 1 a 80 caracteres' using errcode = '22023';
  end if;
  if char_length(coalesce(v_cidade, '')) > 60 then
    raise exception 'cidade deve ter até 60 caracteres' using errcode = '22023';
  end if;
  insert into public.obra (id, nome, cidade, inicio, modelo_rotulo, status, ambiente, created_by)
  values (p_id, v_nome, v_cidade, current_date, '', 'ativa', 'geral', auth.uid());
  return p_id;
end;
$$;

create or replace function salvar_acesso_geral(p_email text, p_nome text, p_papel text, p_obra_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nome text := btrim(coalesce(p_nome, ''));
  v_obras uuid[] := coalesce(p_obra_ids, '{}'::uuid[]);
  v_pessoa public.pessoa%rowtype;
begin
  if not public.contro_e_admin() then
    raise exception 'só administrador dá acesso às obras gerais' using errcode = '42501';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'e-mail inválido' using errcode = '22023';
  end if;
  if v_nome = '' or char_length(v_nome) > 80 then
    raise exception 'nome deve ter de 1 a 80 caracteres' using errcode = '22023';
  end if;
  perform public.contro_valida_acesso_geral(p_papel, v_obras);

  select p.* into v_pessoa
  from auth.users u
  join public.pessoa p on p.user_id = u.id
  where lower(btrim(u.email)) = v_email
  limit 1
  for update of p;

  if found then
    update public.pessoa set
      papel_geral = p_papel,
      nome = case when v_pessoa.papel_geral is null then v_nome else nome end,
      ativo = true,
      desativado_em = null,
      -- Quem não estava ativo (pendente, desativado ou recusado) entra só nas
      -- Obras gerais: dar acesso geral não devolve a Contorno.
      acesso_contorno = case when not v_pessoa.ativo or v_pessoa.deleted_at is not null
                             then false else acesso_contorno end,
      deleted_at = null
    where id = v_pessoa.id;
    perform public.contro_troca_participacoes(v_pessoa.id, v_obras);
    return v_pessoa.id;
  end if;

  insert into public.convite_geral (email, nome, papel, obra_ids, created_by)
  values (v_email, v_nome, p_papel, v_obras, auth.uid())
  on conflict (email) do update set
    nome = excluded.nome,
    papel = excluded.papel,
    obra_ids = excluded.obra_ids,
    created_by = excluded.created_by,
    created_at = now(),
    usado_em = null;
  return null;
end;
$$;

create or replace function definir_acesso_geral(p_pessoa_id uuid, p_papel text, p_obra_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obras uuid[] := coalesce(p_obra_ids, '{}'::uuid[]);
begin
  if not public.contro_e_admin() then
    raise exception 'só administrador altera acesso às obras gerais' using errcode = '42501';
  end if;
  perform public.contro_valida_acesso_geral(p_papel, v_obras);
  update public.pessoa set papel_geral = p_papel
  where id = p_pessoa_id and deleted_at is null;
  if not found then
    raise exception 'pessoa não encontrada' using errcode = '22023';
  end if;
  perform public.contro_troca_participacoes(p_pessoa_id, v_obras);
end;
$$;

create or replace function listar_pessoas_gerais()
returns table (id uuid, nome text, email text, papel text, obra_ids uuid[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.contro_e_admin() then
    raise exception 'só administrador lista as pessoas das obras gerais' using errcode = '42501';
  end if;
  return query
  select p.id, p.nome, u.email::text, p.papel_geral,
    coalesce((
      select array_agg(op.obra_id order by o.nome, op.obra_id)
      from public.obra_participante op
      join public.obra o on o.id = op.obra_id
      where op.pessoa_id = p.id and o.ambiente = 'geral' and o.deleted_at is null
    ), '{}'::uuid[])
  from public.pessoa p
  left join auth.users u on u.id = p.user_id
  where p.ativo and p.deleted_at is null and p.papel_geral is not null
  order by p.nome, p.id;
end;
$$;

revoke execute on function criar_obra_geral(text, text, uuid) from public, anon;
revoke execute on function salvar_acesso_geral(text, text, text, uuid[]) from public, anon;
revoke execute on function definir_acesso_geral(uuid, text, uuid[]) from public, anon;
revoke execute on function listar_pessoas_gerais() from public, anon;
grant execute on function criar_obra_geral(text, text, uuid) to authenticated;
grant execute on function salvar_acesso_geral(text, text, text, uuid[]) to authenticated;
grant execute on function definir_acesso_geral(uuid, text, uuid[]) to authenticated;
grant execute on function listar_pessoas_gerais() to authenticated;

-- Quem está só nas Obras gerais (acesso_contorno=false) não aparece para a
-- Contorno. Pendentes da Contorno continuam visíveis (aprovação do gestor).
-- pessoa_self_sel e pessoa_geral_sel seguem como estão.
drop policy pessoa_sel on pessoa;
create policy pessoa_sel on pessoa for select to authenticated
  using (deleted_at is null and public.contro_e_membro() and acesso_contorno);

-- Cadastro: igual a 20261025050000_auth_cadastro.sql, mais o convite das obras
-- gerais. Com convite em aberto para o e-mail, a pessoa nasce ativa, só nas
-- Obras gerais, com o papel e as obras (ainda gerais e não excluídas) do convite.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite public.convite_geral%rowtype;
  v_pessoa_id uuid;
begin
  select c.* into v_convite
  from public.convite_geral c
  where c.email = lower(btrim(coalesce(new.email, ''))) and c.usado_em is null
  for update;

  if not found then
    insert into public.pessoa (user_id, nome, perfil, ativo)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
      'equipe',
      false
    )
    on conflict (user_id) do nothing;
    return new;
  end if;

  insert into public.pessoa (user_id, nome, perfil, ativo, acesso_contorno, papel_geral)
  values (new.id, v_convite.nome, 'equipe', true, false, v_convite.papel)
  on conflict (user_id) do nothing
  returning id into v_pessoa_id;

  if v_pessoa_id is not null then
    insert into public.obra_participante (obra_id, pessoa_id, created_by)
    select distinct o.id, v_pessoa_id, v_convite.created_by
    from public.obra o
    where o.id = any (v_convite.obra_ids) and o.ambiente = 'geral' and o.deleted_at is null;
    update public.convite_geral set usado_em = now() where email = v_convite.email;
  end if;
  return new;
end;
$$;
