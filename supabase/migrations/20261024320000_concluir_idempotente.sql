-- M9-offline (fatia 2) · concluir_atividade idempotente por client_op_id.
-- O guard fica no TOPO: se o corpo falhar (ex.: não liberada), a transação faz
-- rollback do registro em op_idempotente, então o reenvio tenta de novo. Se o
-- corpo tiver sucesso (commit), o reenvio após resposta perdida vira no-op de
-- sucesso (não devolve "já concluída" nem conta XP duas vezes).

-- Remove as versões antigas de 2 args: o novo parâmetro muda a assinatura, então
-- `create or replace` criaria um OVERLOAD e deixaria a RPC sem guard de
-- idempotência viva (e tornaria ambígua a chamada de 2 args no PostgREST).
drop function if exists public.concluir_atividade(uuid, uuid);
drop function if exists public.marcar_providencia(uuid, boolean);

create or replace function concluir_atividade(
  p_atividade_id uuid,
  p_foto_id uuid,
  p_client_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_obra uuid;
  v_fase uuid;
  v_xp int := 50;
  v_fase_fechada boolean := false;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.obdc_op_nova(p_client_op_id) then
    return jsonb_build_object('xp', 0, 'fase_fechada', false, 'repetida', true);
  end if;

  select obra_id, fase_id into v_obra, v_fase
  from public.obra_atividade where id = p_atividade_id and deleted_at is null and pai_id is null;
  if v_obra is null then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  if p_foto_id is null or not exists (
    select 1 from public.foto where id = p_foto_id and obra_id = v_obra
  ) then
    raise exception 'Conclusão exige foto da obra' using errcode = '23503';
  end if;
  if exists (select 1 from public.obra_atividade where id = p_atividade_id and concluida_em is not null) then
    raise exception 'Atividade já concluída' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.obra_dependencia d
    join public.obra_atividade p on p.id = d.predecessora_id
    where d.atividade_id = p_atividade_id and p.concluida_em is null
  ) then
    raise exception 'Não liberada: predecessoras pendentes' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.obra_providencia
    where atividade_id = p_atividade_id and status = 'pendente'
  ) then
    raise exception 'Não liberada: providências pendentes' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.obra_atividade s where s.pai_id = p_atividade_id and s.concluida_em is null
  ) then
    raise exception 'Faltam subitens marcados' using errcode = '42501';
  end if;

  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade
  set concluida_em = now(), concluida_por = v_pessoa, foto_conclusao_id = p_foto_id
  where id = p_atividade_id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (p_atividade_id, 'concluida', v_pessoa, jsonb_build_object('foto_id', p_foto_id));

  if not exists (
    select 1 from public.obra_atividade
    where fase_id = v_fase and pai_id is null and deleted_at is null and concluida_em is null
  ) then
    v_fase_fechada := true;
    v_xp := v_xp + 200;
  end if;
  update public.obra set xp = xp + v_xp where id = v_obra;

  return jsonb_build_object('xp', v_xp, 'fase_fechada', v_fase_fechada);
end;
$$;
