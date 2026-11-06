-- Reordenar fases e atividades de uma obra geral (06/11/2026), por arrastar e soltar.
-- Quem planeja a obra (Gestor; Coordenador nas dele). A lista enviada tem de ser
-- exatamente a lista atual, em outra ordem: a ordem passa a ser a posição (1..n).
-- O número da fase na trilha sai dessa ordem. A Contorno não muda.

create or replace function reordenar_fases_geral(p_obra_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atuais uuid[];
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  perform public.contro_exige_planejar_geral(p_obra_id);
  select coalesce(array_agg(id order by id), '{}') into v_atuais
    from public.obra_fase where obra_id = p_obra_id;
  if p_ids is null
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
     or (select coalesce(array_agg(x order by x), '{}') from unnest(p_ids) x) <> v_atuais then
    raise exception 'A lista de fases mudou. Atualize e tente de novo.' using errcode = '22023';
  end if;
  update public.obra_fase f set ordem = n.pos
    from unnest(p_ids) with ordinality as n(id, pos)
   where f.id = n.id and f.obra_id = p_obra_id and f.ordem is distinct from n.pos;
end;
$$;
revoke execute on function reordenar_fases_geral(uuid, uuid[]) from public, anon;
grant execute on function reordenar_fases_geral(uuid, uuid[]) to authenticated;

-- Só as atividades da fase (não os subitens, que ficam dentro da atividade).
create or replace function reordenar_atividades_geral(p_fase_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid;
  v_atuais uuid[];
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select obra_id into v_obra from public.obra_fase where id = p_fase_id;
  if v_obra is null then
    raise exception 'Fase inválida' using errcode = '23503';
  end if;
  perform public.contro_exige_planejar_geral(v_obra);
  select coalesce(array_agg(id order by id), '{}') into v_atuais
    from public.obra_atividade
   where fase_id = p_fase_id and pai_id is null and deleted_at is null;
  if p_ids is null
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
     or (select coalesce(array_agg(x order by x), '{}') from unnest(p_ids) x) <> v_atuais then
    raise exception 'A lista de atividades mudou. Atualize e tente de novo.' using errcode = '22023';
  end if;
  update public.obra_atividade a set ordem = n.pos
    from unnest(p_ids) with ordinality as n(id, pos)
   where a.id = n.id and a.fase_id = p_fase_id and a.ordem is distinct from n.pos;
end;
$$;
revoke execute on function reordenar_atividades_geral(uuid, uuid[]) from public, anon;
grant execute on function reordenar_atividades_geral(uuid, uuid[]) to authenticated;
