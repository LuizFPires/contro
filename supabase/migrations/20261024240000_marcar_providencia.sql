-- M3 · marcar_providencia como RPC (grava feito_por/feito_em no servidor) e
-- policy de DELETE em obra_providencia (incluir/remover lembrete pelo cliente).
create or replace function marcar_providencia(p_id uuid, p_feito boolean)
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
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_providencia
  set status = case when p_feito then 'feito' else 'pendente' end,
      feito_em = case when p_feito then now() else null end,
      feito_por = case when p_feito then v_pessoa else null end
  where id = p_id;
end;
$$;

create policy obra_providencia_del on obra_providencia
  for delete to authenticated using (obdc_e_membro());
