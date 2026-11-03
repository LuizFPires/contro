alter table public.pendencia add column responsavel_id uuid references public.pessoa(id);
create index on public.pendencia(responsavel_id) where deleted_at is null;

create or replace function public.atribuir_pendencia(
  p_id uuid, p_responsavel_id uuid, p_client_op_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_anterior uuid; v_pessoa uuid;
begin
  if not public.contro_e_membro() then raise exception 'Apenas membros' using errcode = '42501'; end if;
  v_pessoa := public.contro_pessoa_atual();
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select responsavel_id into v_anterior from public.pendencia
    where id = p_id and deleted_at is null for update;
  if not found then raise exception 'Pendência não encontrada' using errcode = '23503'; end if;
  if p_responsavel_id is not null and not exists (
    select 1 from public.pessoa where id = p_responsavel_id and ativo and deleted_at is null
  ) then raise exception 'Escolha um responsável ativo' using errcode = '23514'; end if;
  if v_anterior is not distinct from p_responsavel_id then return; end if;
  update public.pendencia set responsavel_id = p_responsavel_id where id = p_id;
  insert into public.pendencia_evento(pendencia_id,tipo,por,dados)
  values(p_id,'responsavel_alterado',v_pessoa,jsonb_build_object('antes',v_anterior,'depois',p_responsavel_id));
end;
$$;
revoke all on function public.atribuir_pendencia(uuid,uuid,uuid) from public;
grant execute on function public.atribuir_pendencia(uuid,uuid,uuid) to authenticated;
