-- M9-offline (fatia 5a) · resolver_pendencia idempotente por client_op_id.
-- A foto de depois sobe em 2º plano (como a conclusão de atividade); aqui o RPC
-- só recebe o foto_id já criado. Guard logo após o check de membro: se o corpo
-- falhar (status errado, foto inválida), o rollback desfaz o registro em
-- op_idempotente e o reenvio tenta de novo; em commit, o reenvio vira no-op.
--
-- O novo parâmetro muda a assinatura: removemos a versão antiga para não deixar
-- um OVERLOAD sem guard vivo (e ambíguo no PostgREST).

drop function if exists public.resolver_pendencia(uuid, uuid);

create or replace function resolver_pendencia(
  p_id uuid,
  p_foto_depois_id uuid,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_obra uuid; v_status text;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
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
  v_pessoa := public.contro_pessoa_atual();
  update public.pendencia
  set status = 'em_vistoria', foto_depois_id = p_foto_depois_id,
      resolvida_por = v_pessoa, resolvida_em = now()
  where id = p_id;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (p_id, 'resolvida', v_pessoa, jsonb_build_object('foto_depois_id', p_foto_depois_id));
end;
$$;
