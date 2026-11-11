-- Cadastro escolhe o ambiente (10/11/2026, opção A aprovada pelo usuário).
--
-- Antes, quem criava a conta sem convite de Obras gerais caía sempre na fila de
-- aprovação da Contorno (acesso_contorno = true por padrão), mesmo sendo de Obras
-- gerais (caso Ana Gabriele). Agora a tela de criar conta pergunta onde a pessoa vai
-- trabalhar e manda em raw_user_meta_data.ambiente ('contorno' | 'geral'):
--   * 'geral': nasce pendente e fora da Contorno (acesso_contorno = false). Só o
--     Administrador a vê, em Obras gerais › Pessoas e acessos, e dá o acesso
--     (salvar_acesso_geral) ou a manda para a fila da Contorno (definir_fila_cadastro).
--   * 'contorno' ou sem a informação (versão antiga do app): como antes.
-- Com convite em aberto, nada muda: o convite manda.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite public.convite_geral%rowtype;
  v_pessoa_id uuid;
  v_geral boolean := coalesce(new.raw_user_meta_data ->> 'ambiente', '') = 'geral';
begin
  select c.* into v_convite
  from public.convite_geral c
  where c.email = lower(btrim(coalesce(new.email, ''))) and c.usado_em is null
  for update;

  if not found then
    insert into public.pessoa (user_id, nome, perfil, ativo, acesso_contorno)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
      'equipe',
      false,
      not v_geral
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

-- Aprovar e recusar da Contorno: só quem está na fila da Contorno. Cadastro de
-- Obras gerais não é aprovado nem recusado pelo gestor da Contorno, nem por RPC.
create or replace function aprovar_pessoa(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor aprova membros' using errcode = '42501';
  end if;
  update public.pessoa set ativo = true where id = p_id and acesso_contorno;
  if not found then
    raise exception 'cadastro não está na fila da Contorno' using errcode = '22023';
  end if;
end;
$$;

create or replace function recusar_pessoa(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor recusa membros' using errcode = '42501';
  end if;
  -- Recusar = exclusão lógica (nada se apaga de fato).
  update public.pessoa set deleted_at = now()
  where id = p_id and ativo = false and acesso_contorno;
end;
$$;

-- Fila de Obras gerais: cadastros pendentes que escolheram Obras gerais.
create or replace function listar_cadastros_gerais_pendentes()
returns table (id uuid, nome text, email text, criado_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.contro_e_admin() then
    raise exception 'só administrador vê os cadastros das obras gerais' using errcode = '42501';
  end if;
  return query
  select p.id, p.nome, u.email::text, p.created_at
  from public.pessoa p
  left join auth.users u on u.id = p.user_id
  where not p.ativo and not p.acesso_contorno and p.papel_geral is null
    and p.deleted_at is null and p.desativado_em is null
  order by p.created_at, p.id;
end;
$$;

-- Escolheu o ambiente errado: o Administrador troca a fila do cadastro pendente
-- (p_contorno = true manda para a Contorno; false traz de volta, para o Desfazer).
create or replace function definir_fila_cadastro(p_id uuid, p_contorno boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.contro_e_admin() then
    raise exception 'só administrador troca a fila de um cadastro' using errcode = '42501';
  end if;
  update public.pessoa set acesso_contorno = p_contorno
  where id = p_id and not ativo and papel_geral is null
    and deleted_at is null and desativado_em is null;
  if not found then
    raise exception 'cadastro não está pendente' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function listar_cadastros_gerais_pendentes() from public, anon;
revoke execute on function definir_fila_cadastro(uuid, boolean) from public, anon;
grant execute on function listar_cadastros_gerais_pendentes() to authenticated;
grant execute on function definir_fila_cadastro(uuid, boolean) to authenticated;
