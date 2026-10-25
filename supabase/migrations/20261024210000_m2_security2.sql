-- M2 · Reforço 2 (review): bloquear re-parenting (obra_id/fase_id/pai_id) por
-- cliente e endurecer marcar_subitem (subitem real, pai não concluído, evento).

-- 1) Trigger de proteção também rejeita mudança estrutural pelo cliente.
create or replace function contro_protege_conclusao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.concluida_em is not null
         or new.concluida_por is not null
         or new.foto_conclusao_id is not null then
        raise exception 'Conclusão só por concluir_atividade' using errcode = '42501';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.concluida_em is distinct from old.concluida_em
         or new.concluida_por is distinct from old.concluida_por
         or new.foto_conclusao_id is distinct from old.foto_conclusao_id then
        raise exception 'Conclusão só por concluir_atividade' using errcode = '42501';
      end if;
      if new.obra_id is distinct from old.obra_id
         or new.fase_id is distinct from old.fase_id
         or new.pai_id is distinct from old.pai_id then
        raise exception 'Estrutura da atividade é imutável' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- 2) marcar_subitem: trava e valida subitem real com pai não concluído; grava evento.
create or replace function marcar_subitem(p_subitem_id uuid, p_feito boolean)
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
