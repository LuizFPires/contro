-- Excluir e restaurar subitem pela mesma RPC da atividade. A ficha da Contorno
-- chama excluir_atividade_obra também para a lixeira do subitem, e a versão de
-- 20261106100000 só aceitava atividade de topo (pai_id is null). Cópia dela;
-- muda só o tratamento do subitem. A entrada (contro_tem_acesso +
-- contro_planeja_obra) é a mesma. Obra geral usa excluir_subitem_geral.
create or replace function excluir_atividade_obra(p_atividade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_subs uuid[];
  v_obra uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select obra_id into v_obra from public.obra_atividade
  where id = p_atividade_id and deleted_at is null;
  if v_obra is null then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  if not public.contro_planeja_obra(v_obra) then
    raise exception 'Sem permissão para planejar esta obra' using errcode = '42501';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  -- Atividade de topo leva os subitens abertos junto; o evento guarda quais,
  -- para o Desfazer trazer de volta. Subitem sai sozinho (lista vazia).
  select coalesce(array_agg(id), '{}') into v_subs
  from public.obra_atividade where pai_id = p_atividade_id and deleted_at is null;
  update public.obra_atividade set deleted_at = now()
  where id = p_atividade_id or id = any(v_subs);
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (p_atividade_id, 'excluida', v_pessoa, jsonb_build_object('subitens', to_jsonb(v_subs)));
end;
$$;

create or replace function restaurar_atividade_obra(p_atividade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_subs jsonb;
  v_obra uuid;
  v_pai uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select obra_id, pai_id into v_obra, v_pai from public.obra_atividade
  where id = p_atividade_id and deleted_at is not null;
  if v_obra is null then
    raise exception 'Atividade não está excluída' using errcode = '23503';
  end if;
  if not public.contro_planeja_obra(v_obra) then
    raise exception 'Sem permissão para planejar esta obra' using errcode = '42501';
  end if;
  -- Subitem só volta com o pai de pé.
  if v_pai is not null and exists (
    select 1 from public.obra_atividade where id = v_pai and deleted_at is not null
  ) then
    raise exception 'Atividade de origem está excluída' using errcode = '23503';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  select depois -> 'subitens' into v_subs from public.obra_atividade_evento
  where atividade_id = p_atividade_id and tipo = 'excluida' order by em desc limit 1;
  update public.obra_atividade set deleted_at = null
  where id = p_atividade_id
     or id in (select (jsonb_array_elements_text(coalesce(v_subs, '[]'::jsonb)))::uuid);
  insert into public.obra_atividade_evento (atividade_id, tipo, por)
  values (p_atividade_id, 'restaurada', v_pessoa);
end;
$$;
