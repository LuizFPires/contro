-- Item do Mapa de coleta na obra (pedido do usuário, 04/11/2026): a fase
-- preliminar "Mapa de coleta" recebe um item novo com a antecedência e as
-- atividades de obra que ele libera. Só na obra (o modelo não muda). A exclusão
-- usa excluir_atividade_obra (lógica); as ligações em obra_mapa_libera ficam
-- guardadas para o Desfazer e o cliente ignora as de item excluído.

create or replace function adicionar_mapa_obra(
  p_obra_id uuid,
  p_nome text,
  p_duracao_du int,
  p_antecedencia_du int,
  p_libera uuid[],
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_pessoa uuid;
  v_fase uuid;
  v_ordem int;
  v_libera uuid[];
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  -- Repetição da mesma op (offline): devolve o que já existe, mesmo que um
  -- alvo tenha sido excluído depois.
  if exists (select 1 from public.obra_atividade where id = v_id and obra_id = p_obra_id) then
    return v_id;
  end if;
  select id into v_fase from public.obra_fase
  where obra_id = p_obra_id and preliminar and btrim(titulo) ilike 'mapa%'
  order by ordem limit 1;
  if v_fase is null then
    raise exception 'Obra sem fase Mapa de coleta' using errcode = '23503';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome do item' using errcode = '22023';
  end if;
  if p_duracao_du is null or p_duracao_du < 1 then
    raise exception 'Prazo mínimo de 1 dia útil' using errcode = '22023';
  end if;
  if p_antecedencia_du is null or p_antecedencia_du < 0 then
    raise exception 'Antecedência não pode ser negativa' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct l.id), '{}') into v_libera
  from unnest(coalesce(p_libera, '{}')) l(id) where l.id is not null;
  if cardinality(v_libera) = 0 then
    raise exception 'Escolha ao menos uma atividade liberada' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_libera) l(id)
    where not exists (
      select 1 from public.obra_atividade a
      join public.obra_fase f on f.id = a.fase_id
      where a.id = l.id and a.obra_id = p_obra_id and a.pai_id is null and a.deleted_at is null
        and not f.preliminar
    )
  ) then
    raise exception 'Atividade liberada inválida' using errcode = '23503';
  end if;

  select coalesce(max(ordem), 0) + 1 into v_ordem
  from public.obra_atividade where obra_id = p_obra_id and fase_id = v_fase and pai_id is null;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;

  insert into public.obra_atividade (id, obra_id, fase_id, ordem, nome, duracao_du, em_sequencia, mapa_antecedencia_du)
  values (v_id, p_obra_id, v_fase, v_ordem, trim(p_nome), p_duracao_du, true, p_antecedencia_du);
  insert into public.obra_mapa_libera (obra_id, mapa_id, atividade_id)
  select p_obra_id, v_id, l.id from unnest(v_libera) l(id);
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (v_id, 'criada', v_pessoa, jsonb_build_object(
    'nome', trim(p_nome),
    'duracao_du', p_duracao_du,
    'antecedencia_du', p_antecedencia_du,
    'libera', to_jsonb(v_libera)
  ));
  return v_id;
end;
$$;

revoke all on function adicionar_mapa_obra(uuid, text, int, int, uuid[], uuid) from public, anon;
grant execute on function adicionar_mapa_obra(uuid, text, int, int, uuid[], uuid) to authenticated;
