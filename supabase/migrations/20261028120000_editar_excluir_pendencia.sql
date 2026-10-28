-- Editar e apagar pendência do Check list (pedido do usuário, 28/10/2026): quem
-- apontou errado (foto errada, texto, local, atividade) corrige ou apaga pela
-- lista completa. Qualquer membro, como nas outras ações de campo. Exclusão é
-- lógica (regra 7), com evento, e se desfaz. Idempotente pela op (offline).
-- pendencia segue sem policy de escrita direta: tudo passa por RPC.

create or replace function editar_pendencia(
  p_id uuid,
  p_titulo text,
  p_local text,
  p_criticidade text,
  p_atividade_id uuid default null,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid;
  v_antes jsonb;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select obra_id, jsonb_build_object('titulo', titulo, 'local', local,
           'criticidade', criticidade, 'atividade_id', atividade_id)
  into v_obra, v_antes
  from public.pendencia where id = p_id and deleted_at is null
  for update;
  if v_obra is null then
    raise exception 'Pendência não encontrada' using errcode = '23503';
  end if;
  if coalesce(trim(p_titulo), '') = '' then
    raise exception 'Título obrigatório' using errcode = '23514';
  end if;
  if coalesce(p_criticidade, 'media') not in ('alta', 'media', 'baixa') then
    raise exception 'Criticidade inválida' using errcode = '23514';
  end if;
  if p_atividade_id is not null and not exists (
    select 1 from public.obra_atividade where id = p_atividade_id and obra_id = v_obra
  ) then
    raise exception 'Atividade não é desta obra' using errcode = '23503';
  end if;

  update public.pendencia
  set titulo = trim(p_titulo),
      local = nullif(trim(coalesce(p_local, '')), ''),
      criticidade = coalesce(p_criticidade, 'media'),
      atividade_id = p_atividade_id
  where id = p_id;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (p_id, 'editada', public.contro_pessoa_atual(), jsonb_build_object('antes', v_antes));
end;
$$;

create or replace function excluir_pendencia(p_id uuid, p_client_op_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  update public.pendencia set deleted_at = now() where id = p_id and deleted_at is null;
  if not found then
    raise exception 'Pendência não encontrada' using errcode = '23503';
  end if;
  insert into public.pendencia_evento (pendencia_id, tipo, por)
  values (p_id, 'excluida', public.contro_pessoa_atual());
end;
$$;

create or replace function restaurar_pendencia(p_id uuid, p_client_op_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  update public.pendencia set deleted_at = null where id = p_id and deleted_at is not null;
  if not found then
    raise exception 'Pendência não está apagada' using errcode = '23503';
  end if;
  insert into public.pendencia_evento (pendencia_id, tipo, por)
  values (p_id, 'restaurada', public.contro_pessoa_atual());
end;
$$;

revoke execute on function editar_pendencia(uuid, text, text, text, uuid, uuid) from public, anon;
revoke execute on function excluir_pendencia(uuid, uuid) from public, anon;
revoke execute on function restaurar_pendencia(uuid, uuid) from public, anon;
grant execute on function editar_pendencia(uuid, text, text, text, uuid, uuid) to authenticated;
grant execute on function excluir_pendencia(uuid, uuid) to authenticated;
grant execute on function restaurar_pendencia(uuid, uuid) to authenticated;
