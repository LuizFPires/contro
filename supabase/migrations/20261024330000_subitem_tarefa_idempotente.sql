-- M9-offline (fatia 3) · idempotência por client_op_id em marcar_subitem,
-- concluir_tarefa e reabrir_tarefa (ações de campo otimistas/offline).
-- O guard fica logo após o check de membro: se o corpo falhar, o rollback da
-- transação desfaz o registro em op_idempotente e o reenvio tenta de novo; se
-- der commit, o reenvio (resposta perdida) vira no-op (sem evento duplicado nem
-- efeito de vínculo aplicado duas vezes).

-- O novo parâmetro muda a assinatura, então removemos as versões antigas para
-- não deixar um OVERLOAD sem guard de idempotência vivo (e ambíguo no PostgREST).
drop function if exists public.marcar_subitem(uuid, boolean);
drop function if exists public.concluir_tarefa(uuid);
drop function if exists public.reabrir_tarefa(uuid);

create or replace function marcar_subitem(
  p_subitem_id uuid,
  p_feito boolean,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_pai uuid;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select a.pai_id into v_pai
  from public.obra_atividade a
  join public.obra_atividade pa on pa.id = a.pai_id
  where a.id = p_subitem_id and a.pai_id is not null and a.deleted_at is null
    and pa.deleted_at is null and pa.concluida_em is null
  for update of a;
  if v_pai is null then
    raise exception 'Subitem inválido ou atividade já concluída' using errcode = '42501';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade
  set concluida_em = case when p_feito then now() else null end,
      concluida_por = case when p_feito then v_pessoa else null end
  where id = p_subitem_id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (p_subitem_id, 'subitem', v_pessoa, jsonb_build_object('feito', p_feito));
end;
$$;

create or replace function concluir_tarefa(p_id uuid, p_client_op_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_t public.tarefa;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select * into v_t from public.tarefa where id = p_id and deleted_at is null;
  if v_t.id is null then
    raise exception 'Tarefa inválida' using errcode = '23503';
  end if;
  v_pessoa := public.contro_pessoa_atual();

  if v_t.vinculo_tipo = 'providencia' and v_t.vinculo_id is not null then
    update public.obra_providencia
    set status = 'feito', feito_em = now(), feito_por = v_pessoa
    where id = v_t.vinculo_id and obra_id = v_t.obra_id and status = 'pendente';
    if found then
      update public.tarefa set efeito_providencia_id = v_t.vinculo_id where id = p_id;
    end if;
  end if;

  update public.tarefa set status = 'feita', feita_em = now(), feita_por = v_pessoa where id = p_id;
  insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'concluida', v_pessoa);
end;
$$;

create or replace function reabrir_tarefa(p_id uuid, p_client_op_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_t public.tarefa; v_atv_concluida boolean;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select * into v_t from public.tarefa where id = p_id and deleted_at is null;
  if v_t.id is null then
    raise exception 'Tarefa inválida' using errcode = '23503';
  end if;
  v_pessoa := public.contro_pessoa_atual();

  if v_t.efeito_providencia_id is not null then
    select oa.concluida_em is not null into v_atv_concluida
    from public.obra_providencia op
    join public.obra_atividade oa on oa.id = op.atividade_id
    where op.id = v_t.efeito_providencia_id and op.obra_id = v_t.obra_id;
    if not coalesce(v_atv_concluida, false) then
      update public.obra_providencia
      set status = 'pendente', feito_em = null, feito_por = null
      where id = v_t.efeito_providencia_id and obra_id = v_t.obra_id;
      update public.tarefa set efeito_providencia_id = null where id = p_id;
    end if;
  end if;

  update public.tarefa set status = 'aberta', feita_em = null, feita_por = null where id = p_id;
  insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'reaberta', v_pessoa);
end;
$$;
