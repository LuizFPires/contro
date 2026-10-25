-- M9-offline (fatia 5d) · excluir/restaurar tarefa idempotentes por client_op_id
-- (ações de campo otimistas/offline, com "Desfazer"). Guard logo após o check de
-- membro: o reenvio da mesma op vira no-op (sem redefinir deleted_at nem duplicar
-- evento); em falha, o rollback desfaz o registro da op.
--
-- O novo parâmetro muda a assinatura: removemos as versões antigas de 1 arg.

drop function if exists public.excluir_tarefa(uuid);
drop function if exists public.restaurar_tarefa(uuid);

create or replace function excluir_tarefa(p_id uuid, p_client_op_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.obdc_op_nova(p_client_op_id) then return; end if;
  v_pessoa := public.obdc_pessoa_atual();
  update public.tarefa set deleted_at = now() where id = p_id and deleted_at is null;
  insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'excluida', v_pessoa);
end;
$$;

create or replace function restaurar_tarefa(p_id uuid, p_client_op_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.obdc_op_nova(p_client_op_id) then return; end if;
  v_pessoa := public.obdc_pessoa_atual();
  update public.tarefa set deleted_at = null where id = p_id;
  insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'restaurada', v_pessoa);
end;
$$;
