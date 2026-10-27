-- Apagar obra (pedido do usuário, 27/10/2026): só o gestor, sempre com
-- confirmação na tela. Exclusão lógica (regra 7): a obra some das listas,
-- reunião e boletim (todos já filtram deleted_at), e o Desfazer a traz de volta.
alter table obra add column excluida_por uuid references pessoa (id);

create or replace function excluir_obra(p_obra_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor apaga obra' using errcode = '42501';
  end if;
  update public.obra
  set deleted_at = now(),
      excluida_por = (select id from public.pessoa where user_id = auth.uid() and deleted_at is null)
  where id = p_obra_id and deleted_at is null;
  if not found then
    raise exception 'Obra inválida' using errcode = '23503';
  end if;
end;
$$;

create or replace function restaurar_obra(p_obra_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor restaura obra' using errcode = '42501';
  end if;
  update public.obra set deleted_at = null, excluida_por = null
  where id = p_obra_id and deleted_at is not null;
  if not found then
    raise exception 'Obra não está apagada' using errcode = '23503';
  end if;
end;
$$;

-- A policy obra_upd deixa qualquer membro atualizar a obra: sem esta trava, a
-- equipe poderia apagar a obra por update direto. Só as funções acima (security
-- definer, rodam como dono) mudam deleted_at/excluida_por.
create or replace function contro_protege_exclusao_obra()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and (new.deleted_at is distinct from old.deleted_at
          or new.excluida_por is distinct from old.excluida_por) then
    raise exception 'Apagar obra só pelo gestor (excluir_obra)' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger obra_protege_exclusao before update on obra
  for each row execute function contro_protege_exclusao_obra();

revoke execute on function excluir_obra(uuid) from public, anon;
revoke execute on function restaurar_obra(uuid) from public, anon;
grant execute on function excluir_obra(uuid) to authenticated;
grant execute on function restaurar_obra(uuid) to authenticated;
