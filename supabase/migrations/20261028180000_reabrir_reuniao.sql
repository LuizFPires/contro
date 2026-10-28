-- Reabrir a pauta da reunião (pedido do usuário, 28/10/2026): a ata da semana foi
-- fechada com obras que depois foram apagadas e ficou vazia. Só o gestor (como
-- fechar). A reunião volta a ser pauta e ganha as obras ativas de hoje; as
-- observações e snapshots já gravados ficam (nada se apaga).

create or replace function reabrir_reuniao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor reabre a pauta' using errcode = '42501';
  end if;
  update public.reuniao
  set status = 'pauta', fechada_em = null, fechada_por = null
  where id = p_id and status = 'fechada';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Reunião não está fechada' using errcode = '42501';
  end if;
  insert into public.reuniao_obra (reuniao_id, obra_id)
  select p_id, o.id from public.obra o where o.status = 'ativa' and o.deleted_at is null
  on conflict (reuniao_id, obra_id) do nothing;
end;
$$;

revoke execute on function reabrir_reuniao(uuid) from public, anon;
grant execute on function reabrir_reuniao(uuid) to authenticated;
