-- Cadastro aberto com aprovação do gestor.
-- No signup, cria a pessoa como PENDENTE (ativo=false): a pessoa loga mas não é
-- membro (contro_e_membro exige ativo) até o gestor aprovar. O nome vem do
-- metadata do signup (options.data.nome); sem ele, usa a parte antes do @.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pessoa (user_id, nome, perfil, ativo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    'equipe',
    false
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- A pessoa pode ler a PRÓPRIA linha mesmo pendente (para o app mostrar
-- "aguardando aprovação"). Soma-se à política pessoa_sel (membros ativos).
create policy pessoa_self_sel on pessoa for select to authenticated
  using (user_id = auth.uid());

-- Aprovar / recusar signups pendentes (só gestor). SECURITY DEFINER para não
-- depender de sutilezas do RLS no update.
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
  update public.pessoa set ativo = true where id = p_id;
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
  update public.pessoa set deleted_at = now() where id = p_id and ativo = false;
end;
$$;
