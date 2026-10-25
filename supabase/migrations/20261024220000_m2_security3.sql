-- M2 · Reforço 3 (review): no INSERT, validar o pai do subitem (mesma obra/fase,
-- não excluído, não concluído, de topo) e tornar id imutável no UPDATE.
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
      if new.pai_id is not null then
        if not exists (
          select 1 from public.obra_atividade p
          where p.id = new.pai_id and p.deleted_at is null and p.concluida_em is null
            and p.obra_id = new.obra_id and p.fase_id = new.fase_id and p.pai_id is null
        ) then
          raise exception 'Subitem precisa de pai de topo na mesma obra/fase' using errcode = '42501';
        end if;
      end if;
    elsif tg_op = 'UPDATE' then
      if new.id is distinct from old.id then
        raise exception 'id é imutável' using errcode = '42501';
      end if;
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
