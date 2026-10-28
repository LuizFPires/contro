-- Check list sem vistoria (decisão do usuário, 28/10/2026): tirou a foto do
-- depois, a pendência está resolvida. resolver_pendencia passa a fechar direto
-- (status 'fechada'), sem a etapa 'em_vistoria' e sem aprovação de outra pessoa
-- (a antiga regra 5 sai). As que estavam em vistoria viram resolvidas, com evento.
-- vistoriar_pendencia fica no banco sem uso.

create or replace function resolver_pendencia(
  p_id uuid,
  p_foto_depois_id uuid,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_obra uuid; v_status text;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select obra_id, status into v_obra, v_status
  from public.pendencia where id = p_id and deleted_at is null;
  if v_obra is null then
    raise exception 'Pendência inválida' using errcode = '23503';
  end if;
  if v_status <> 'aberta' then
    raise exception 'Só resolve pendência aberta' using errcode = '42501';
  end if;
  if p_foto_depois_id is null or not exists (
    select 1 from public.foto where id = p_foto_depois_id and obra_id = v_obra
  ) then
    raise exception 'Resolver exige foto de depois da obra' using errcode = '23503';
  end if;
  v_pessoa := public.contro_pessoa_atual();
  update public.pendencia
  set status = 'fechada', foto_depois_id = p_foto_depois_id,
      resolvida_por = v_pessoa, resolvida_em = now()
  where id = p_id;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (p_id, 'resolvida', v_pessoa, jsonb_build_object('foto_depois_id', p_foto_depois_id));
end;
$$;

-- As que esperavam vistoria passam a resolvidas (registro do porquê no evento).
insert into pendencia_evento (pendencia_id, tipo, dados)
select id, 'fechada_sem_vistoria', jsonb_build_object('motivo', 'Check list sem vistoria (28/10/2026)')
from pendencia where status = 'em_vistoria' and deleted_at is null;
update pendencia set status = 'fechada' where status = 'em_vistoria';
