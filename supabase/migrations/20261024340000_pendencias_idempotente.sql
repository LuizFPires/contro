-- M9-offline (fatia 4) · idempotência por client_op_id em adiar/trazer/vistoriar
-- pendência (ações de campo otimistas/offline). Guard logo após o check de
-- membro: se o corpo falhar (regra 5, status errado), o rollback desfaz o
-- registro em op_idempotente e o reenvio tenta de novo; se der commit, o reenvio
-- (resposta perdida) vira no-op, sem evento duplicado nem transição repetida.
--
-- O novo parâmetro muda a assinatura: removemos as versões antigas para não
-- deixar um OVERLOAD sem guard vivo (e ambíguo no PostgREST).

drop function if exists public.adiar_pendencia(uuid, date, text);
drop function if exists public.trazer_pendencia(uuid);
drop function if exists public.vistoriar_pendencia(uuid, boolean, text);

create or replace function adiar_pendencia(
  p_id uuid,
  p_data date,
  p_motivo text,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_status text;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.obdc_op_nova(p_client_op_id) then return; end if;
  select status into v_status from public.pendencia where id = p_id and deleted_at is null;
  if v_status is null then
    raise exception 'Pendência inválida' using errcode = '23503';
  end if;
  if v_status <> 'aberta' then
    raise exception 'Só adia pendência aberta' using errcode = '42501';
  end if;
  if p_data is null or p_data <= current_date then
    raise exception 'Data de retorno deve ser futura' using errcode = '23514';
  end if;
  v_pessoa := public.obdc_pessoa_atual();
  update public.pendencia
  set adiada_ate = p_data, motivo_adiamento = p_motivo
  where id = p_id;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (p_id, 'adiada', v_pessoa, jsonb_build_object('adiada_ate', p_data, 'motivo', p_motivo));
end;
$$;

create or replace function trazer_pendencia(p_id uuid, p_client_op_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_obra uuid; v_status text; v_topo numeric;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.obdc_op_nova(p_client_op_id) then return; end if;
  select obra_id, status into v_obra, v_status
  from public.pendencia where id = p_id and deleted_at is null;
  if v_obra is null then
    raise exception 'Pendência inválida' using errcode = '23503';
  end if;
  if v_status <> 'aberta' then
    raise exception 'Só traz pendência aberta' using errcode = '42501';
  end if;
  v_pessoa := public.obdc_pessoa_atual();
  select coalesce(min(ordem_fila), 0) - 1 into v_topo from public.pendencia where obra_id = v_obra;
  update public.pendencia
  set adiada_ate = null, motivo_adiamento = null, ordem_fila = v_topo
  where id = p_id;
  insert into public.pendencia_evento (pendencia_id, tipo, por)
  values (p_id, 'trazida', v_pessoa);
end;
$$;

create or replace function vistoriar_pendencia(
  p_id uuid,
  p_aprovado boolean,
  p_motivo text default null,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_obra uuid; v_status text; v_resolvida_por uuid; v_topo numeric;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.obdc_op_nova(p_client_op_id) then return; end if;
  select obra_id, status, resolvida_por into v_obra, v_status, v_resolvida_por
  from public.pendencia where id = p_id and deleted_at is null;
  if v_obra is null then
    raise exception 'Pendência inválida' using errcode = '23503';
  end if;
  if v_status <> 'em_vistoria' then
    raise exception 'Só vistoria pendência em vistoria' using errcode = '42501';
  end if;
  v_pessoa := public.obdc_pessoa_atual();
  if v_pessoa = v_resolvida_por then
    raise exception 'Quem resolveu não pode vistoriar a própria pendência' using errcode = '42501';
  end if;
  if p_aprovado then
    update public.pendencia
    set status = 'fechada', vistoriada_por = v_pessoa, vistoriada_em = now()
    where id = p_id;
    insert into public.pendencia_evento (pendencia_id, tipo, por)
    values (p_id, 'aprovada', v_pessoa);
  else
    select coalesce(min(ordem_fila), 0) - 1 into v_topo from public.pendencia where obra_id = v_obra;
    update public.pendencia
    set status = 'aberta', foto_depois_id = null, resolvida_por = null, resolvida_em = null,
        adiada_ate = null, motivo_adiamento = null, ordem_fila = v_topo
    where id = p_id;
    insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
    values (p_id, 'reaberta', v_pessoa, jsonb_build_object('motivo', p_motivo));
  end if;
end;
$$;
