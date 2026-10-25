-- M9-offline (fatia 5b) · apontar_pendencia idempotente com id gerado no cliente.
-- Para funcionar offline, o cliente gera o id da pendência e o envia; o insert
-- usa esse id com `on conflict do nothing`, e o guard obdc_op_nova no topo evita
-- reprocessar o corpo (evento, ordem_fila) no reenvio. A foto do antes sobe em
-- 2º plano (como a conclusão), então o RPC recebe o foto_id já criado.
--
-- O novo parâmetro muda a assinatura: removemos a versão antiga para não deixar
-- um OVERLOAD sem guard vivo (e ambíguo no PostgREST).

drop function if exists public.apontar_pendencia(uuid, text, text, text, uuid, uuid);

create or replace function apontar_pendencia(
  p_id uuid,
  p_obra_id uuid,
  p_titulo text,
  p_local text,
  p_criticidade text,
  p_foto_antes_id uuid,
  p_atividade_id uuid default null,
  p_client_op_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_topo numeric;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.obdc_op_nova(p_client_op_id) then return p_id; end if;
  if p_foto_antes_id is null or not exists (
    select 1 from public.foto where id = p_foto_antes_id and obra_id = p_obra_id
  ) then
    raise exception 'Apontar exige foto da obra' using errcode = '23503';
  end if;
  if coalesce(trim(p_titulo), '') = '' then
    raise exception 'Título obrigatório' using errcode = '23514';
  end if;
  if p_atividade_id is not null and not exists (
    select 1 from public.obra_atividade where id = p_atividade_id and obra_id = p_obra_id
  ) then
    raise exception 'Atividade não é desta obra' using errcode = '23503';
  end if;
  v_pessoa := public.obdc_pessoa_atual();
  select coalesce(min(ordem_fila), 0) - 1 into v_topo from public.pendencia where obra_id = p_obra_id;
  insert into public.pendencia (
    id, obra_id, atividade_id, titulo, local, criticidade, foto_antes_id,
    apontada_por, status, ordem_fila
  ) values (
    p_id, p_obra_id, p_atividade_id, p_titulo, p_local,
    coalesce(p_criticidade, 'media'), p_foto_antes_id, v_pessoa, 'aberta', v_topo
  )
  on conflict (id) do nothing;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (p_id, 'apontada', v_pessoa, jsonb_build_object('foto_antes_id', p_foto_antes_id));
  return p_id;
end;
$$;
