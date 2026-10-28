-- Avanço parcial da atividade (pedido do usuário, 28/10/2026): além de concluída
-- ou não, a atividade aberta guarda quanto já foi feito (anel na trilha, cada
-- toque +25%; cards 25 · 50 · 75 · Pronta na ficha). 100% é a conclusão de
-- sempre (concluir_atividade), então aqui só se grava de 0 a 99. Desfazer a
-- conclusão mantém o avanço que a atividade tinha. Mapa de coleta segue check.

alter table obra_atividade
  add column avanco_pct smallint not null default 0 check (avanco_pct between 0 and 100);

create or replace function definir_avanco(
  p_atividade_id uuid,
  p_pct int,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_antes int;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if p_pct is null or p_pct < 0 or p_pct > 99 then
    raise exception 'Avanço de 0 a 99%% (100%% é concluir)' using errcode = '22023';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;

  select avanco_pct into v_antes
  from public.obra_atividade
  where id = p_atividade_id and deleted_at is null and pai_id is null
    and mapa_antecedencia_du is null
  for update;
  if not found then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  if exists (select 1 from public.obra_atividade where id = p_atividade_id and concluida_em is not null) then
    raise exception 'Atividade já concluída' using errcode = '23505';
  end if;
  if v_antes = p_pct then
    return;
  end if;

  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade set avanco_pct = p_pct where id = p_atividade_id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
  values (p_atividade_id, 'avanco', v_pessoa,
          jsonb_build_object('pct', v_antes), jsonb_build_object('pct', p_pct));
end;
$$;

revoke execute on function definir_avanco(uuid, int, uuid) from public, anon;
grant execute on function definir_avanco(uuid, int, uuid) to authenticated;
