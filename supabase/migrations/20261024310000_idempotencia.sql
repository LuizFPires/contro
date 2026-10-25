-- M9-offline · Idempotência das ações de campo. A fila offline (outbox) pode
-- reenviar a mesma op após uma queda de rede já com o commit feito; o
-- `client_op_id` garante "aplicar no máximo uma vez". As RPCs de campo ganham
-- `p_client_op_id` (opcional) e saem cedo se a op já foi aplicada.

create table op_idempotente (
  client_op_id uuid primary key,
  em timestamptz not null default now()
);
alter table op_idempotente enable row level security;
-- sem policies: só as RPCs SECURITY DEFINER (via owner) escrevem/leem.

-- Registra a op e diz se é NOVA (true) ou repetida (false). p_op nulo = sempre nova
-- (chamada online sem fila).
create or replace function contro_op_nova(p_op uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_op is null then
    return true;
  end if;
  insert into public.op_idempotente (client_op_id) values (p_op)
  on conflict (client_op_id) do nothing;
  return found; -- found = inseriu agora = é nova
end;
$$;
revoke execute on function contro_op_nova(uuid) from public, anon, authenticated;

-- marcar_providencia idempotente por client_op_id (mantém o corpo do M3).
create or replace function marcar_providencia(p_id uuid, p_feito boolean, p_client_op_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return; -- já aplicada (reenvio da fila)
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_providencia
  set status = case when p_feito then 'feito' else 'pendente' end,
      feito_em = case when p_feito then now() else null end,
      feito_por = case when p_feito then v_pessoa else null end
  where id = p_id;
end;
$$;
