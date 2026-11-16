-- Quantitativo sem pessoas previstas (pedido do usuário, 16/11/2026): o
-- quantitativo abre numa gaveta só com quantidade e unidade; as pessoas entram em
-- cada medição. definir_quantitativo passa a aceitar p_pessoas nulo (a coluna
-- quant_pessoas fica, opcional, para quem já tinha preenchido).

create or replace function definir_quantitativo(
  p_atividade_id uuid,
  p_total numeric,
  p_unidade text,
  p_pessoas int,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_antes jsonb;
begin
  perform public.contro_atividade_de_campo(p_atividade_id);
  if p_total is not null and (p_total <= 0 or p_unidade is null
     or (p_pessoas is not null and p_pessoas < 1)) then
    raise exception 'Quantidade e unidade são obrigatórias' using errcode = '22023';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;
  select jsonb_build_object('total', quant_total, 'unidade', quant_unidade, 'pessoas', quant_pessoas)
  into v_antes from public.obra_atividade where id = p_atividade_id for update;

  update public.obra_atividade
  set quant_total = p_total,
      quant_unidade = case when p_total is null then null else p_unidade end,
      quant_pessoas = case when p_total is null then null else p_pessoas end
  where id = p_atividade_id;

  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
  values (p_atividade_id, 'quantitativo', v_pessoa, v_antes,
          jsonb_build_object('total', p_total, 'unidade', p_unidade, 'pessoas', p_pessoas));
  perform public.contro_recalcular_avanco_medido(p_atividade_id);
end;
$$;
revoke execute on function definir_quantitativo(uuid, numeric, text, int, uuid) from public, anon;
grant execute on function definir_quantitativo(uuid, numeric, text, int, uuid) to authenticated;
