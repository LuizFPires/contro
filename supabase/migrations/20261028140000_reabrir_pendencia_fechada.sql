-- Voltar para pendente um item concluído do Check list (pedido do usuário,
-- 28/10/2026): foi dado como vistoriado, mas não estava resolvido de fato.
-- Quem reabre escolhe manter a foto do depois (fica como registro até a nova
-- foto) ou tirá-la. Volta para a fila, sem resolvido/vistoriado. A foto nunca é
-- apagada do arquivo (regra 7): o id fica no evento 'reaberta'.

create or replace function reabrir_pendencia(
  p_id uuid,
  p_manter_foto boolean,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid;
  v_status text;
  v_foto uuid;
  v_topo numeric;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select obra_id, status, foto_depois_id into v_obra, v_status, v_foto
  from public.pendencia where id = p_id and deleted_at is null
  for update;
  if v_obra is null then
    raise exception 'Pendência inválida' using errcode = '23503';
  end if;
  if v_status <> 'fechada' then
    raise exception 'Só volta para pendente uma pendência concluída' using errcode = '42501';
  end if;

  select coalesce(min(ordem_fila), 0) - 1 into v_topo from public.pendencia where obra_id = v_obra;
  update public.pendencia
  set status = 'aberta',
      foto_depois_id = case when p_manter_foto then foto_depois_id else null end,
      resolvida_por = null, resolvida_em = null,
      vistoriada_por = null, vistoriada_em = null,
      adiada_ate = null, motivo_adiamento = null,
      ordem_fila = v_topo
  where id = p_id;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (p_id, 'reaberta', public.contro_pessoa_atual(),
          jsonb_build_object('de', 'fechada', 'foto_depois_id', v_foto, 'manteve_foto', p_manter_foto));
end;
$$;

revoke execute on function reabrir_pendencia(uuid, boolean, uuid) from public, anon;
grant execute on function reabrir_pendencia(uuid, boolean, uuid) to authenticated;
