-- Obras gerais · Etapa 2, ajustes da revisão final.
-- 1) As funções de planejamento da Contorno (gate só contro_e_membro()) não
--    servem para obra geral: quem tem acesso à Contorno e é Membro de uma obra
--    geral não planeja por elas. Cada uma é cópia da última versão, só com a
--    guarda depois da busca da obra: obra geral → 23505 (use as funções da obra
--    geral). Na Contorno o resultado é o mesmo de antes.
-- 2) Mapa de coleta (obra_mapa_libera, mapa_proposta): escrita direta só para
--    quem planeja a obra, como fase, atividade, dependência e providência.

-- adicionar_atividade_obra: cópia de 20261027140000_adicionar_excluir_atividade.sql, com a guarda da obra geral.
create or replace function adicionar_atividade_obra(
  p_obra_id uuid,
  p_fase_id uuid,
  p_nome text,
  p_duracao_du int,
  p_predecessoras uuid[] default '{}',
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
  v_ordem int;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if (select ambiente from public.obra where id = p_obra_id) <> 'contorno' then
    raise exception 'Use as funções da obra geral' using errcode = '23505';
  end if;
  if not exists (select 1 from public.obra_fase where id = p_fase_id and obra_id = p_obra_id) then
    raise exception 'Fase não é desta obra' using errcode = '23503';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome da atividade' using errcode = '22023';
  end if;
  if p_duracao_du is null or p_duracao_du < 1 then
    raise exception 'Prazo mínimo de 1 dia útil' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_predecessoras) p(id)
    where not exists (
      select 1 from public.obra_atividade a
      where a.id = p.id and a.obra_id = p_obra_id and a.deleted_at is null and a.pai_id is null
    )
  ) then
    raise exception 'Predecessora não é desta obra' using errcode = '23503';
  end if;
  -- Repetição da mesma op (offline): devolve a que já existe.
  if exists (select 1 from public.obra_atividade where id = v_id) then
    return v_id;
  end if;

  select coalesce(max(ordem), 0) + 1 into v_ordem
  from public.obra_atividade where obra_id = p_obra_id and fase_id = p_fase_id and pai_id is null;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;

  insert into public.obra_atividade (id, obra_id, fase_id, ordem, nome, duracao_du, em_sequencia)
  values (v_id, p_obra_id, p_fase_id, v_ordem, trim(p_nome), p_duracao_du, true);
  insert into public.obra_dependencia (obra_id, atividade_id, predecessora_id)
  select p_obra_id, v_id, p.id from (select distinct unnest(p_predecessoras) as id) p;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (v_id, 'criada', v_pessoa, jsonb_build_object('nome', trim(p_nome), 'duracao_du', p_duracao_du));
  return v_id;
end;
$$;

-- ajustar_inicio: cópia de 20261024200000_obra_rpcs.sql, com a guarda da obra geral.
create or replace function ajustar_inicio(p_atividade_id uuid, p_data date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_antes date; v_obra uuid;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select obra_id into v_obra from public.obra_atividade where id = p_atividade_id;
  if (select ambiente from public.obra where id = v_obra) <> 'contorno' then
    raise exception 'Use as funções da obra geral' using errcode = '23505';
  end if;
  select inicio_manual into v_antes from public.obra_atividade where id = p_atividade_id;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade set inicio_manual = p_data where id = p_atividade_id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
  values (
    p_atividade_id, 'inicio_ajustado', v_pessoa,
    jsonb_build_object('inicio_manual', v_antes),
    jsonb_build_object('inicio_manual', p_data)
  );
end;
$$;

-- adicionar_mapa_obra: cópia de 20261104400000_adicionar_mapa.sql, com a guarda da obra geral.
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
  if (select ambiente from public.obra where id = p_obra_id) <> 'contorno' then
    raise exception 'Use as funções da obra geral' using errcode = '23505';
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

-- atualizar_prazos_atividades: cópia de 20261104500000_atividade_prazo.sql, com a guarda da obra geral.
create or replace function public.atualizar_prazos_atividades(p_obra_id uuid, p_prazos jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not exists (select 1 from public.obra where id = p_obra_id and deleted_at is null) then
    raise exception 'Obra não encontrada' using errcode = '23503';
  end if;
  if (select ambiente from public.obra where id = p_obra_id) <> 'contorno' then
    raise exception 'Use as funções da obra geral' using errcode = '23505';
  end if;
  update public.obra_atividade oa
     set fim_previsto_calc = x.ate
    from jsonb_to_recordset(coalesce(p_prazos, '[]'::jsonb)) as x(id uuid, ate date)
   where oa.id = x.id
     and oa.obra_id = p_obra_id
     and oa.fim_previsto_calc is distinct from x.ate;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- atualizar_prazos_providencias: cópia de 20261104200000_providencia_prazo.sql, com a guarda da obra geral.
create or replace function public.atualizar_prazos_providencias(p_obra_id uuid, p_prazos jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not exists (select 1 from public.obra where id = p_obra_id and deleted_at is null) then
    raise exception 'Obra não encontrada' using errcode = '23503';
  end if;
  if (select ambiente from public.obra where id = p_obra_id) <> 'contorno' then
    raise exception 'Use as funções da obra geral' using errcode = '23505';
  end if;
  update public.obra_providencia op
     set providenciar_ate = x.ate
    from jsonb_to_recordset(coalesce(p_prazos, '[]'::jsonb)) as x(id uuid, ate date)
   where op.id = x.id
     and op.obra_id = p_obra_id
     and op.providenciar_ate is distinct from x.ate;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- fixar_entrega_original: cópia de 20261026140000_plano_recuperacao.sql, com a guarda da obra geral.
create or replace function fixar_entrega_original(p_obra_id uuid, p_data date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if (select ambiente from public.obra where id = p_obra_id) <> 'contorno' then
    raise exception 'Use as funções da obra geral' using errcode = '23505';
  end if;
  if p_data is null then return; end if;
  update public.obra set entrega_original = p_data
  where id = p_obra_id and entrega_original is null and deleted_at is null;
end;
$$;

-- aplicar_plano_recuperacao: cópia de 20261026140000_plano_recuperacao.sql, com a guarda da obra geral.
create or replace function aplicar_plano_recuperacao(
  p_obra_id uuid,
  p_entrega_original date,
  p_duracoes jsonb default '[]',
  p_defasagens jsonb default '[]',
  p_tarefas jsonb default '[]'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_item jsonb;
  v_atv uuid;
  v_antes int;
  v_novo int;
  v_tarefa uuid;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not exists (select 1 from public.obra where id = p_obra_id and deleted_at is null) then
    raise exception 'Obra inválida' using errcode = '23503';
  end if;
  if (select ambiente from public.obra where id = p_obra_id) <> 'contorno' then
    raise exception 'Use as funções da obra geral' using errcode = '23505';
  end if;
  v_pessoa := public.contro_pessoa_atual();

  -- A data planejada fica guardada antes de o plano mexer no cronograma.
  update public.obra set entrega_original = coalesce(entrega_original, p_entrega_original)
  where id = p_obra_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_duracoes, '[]')) loop
    v_atv := (v_item->>'atividade_id')::uuid;
    v_novo := (v_item->>'duracao_du')::int;
    if v_novo is null or v_novo < 1 then
      raise exception 'Duração deve ser ≥ 1 dia útil' using errcode = '23514';
    end if;
    select duracao_du into v_antes from public.obra_atividade
    where id = v_atv and obra_id = p_obra_id and pai_id is null and deleted_at is null
    for update;
    if v_antes is null then
      raise exception 'Atividade não é desta obra' using errcode = '23503';
    end if;
    update public.obra_atividade set duracao_du = v_novo where id = v_atv;
    insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
    values (v_atv, 'plano_recuperacao', v_pessoa,
            jsonb_build_object('duracao_du', v_antes), jsonb_build_object('duracao_du', v_novo));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_defasagens, '[]')) loop
    v_atv := (v_item->>'atividade_id')::uuid;
    v_novo := (v_item->>'defasagem_du')::int;
    select defasagem_du into v_antes from public.obra_dependencia
    where obra_id = p_obra_id and atividade_id = v_atv
      and predecessora_id = (v_item->>'predecessora_id')::uuid
    for update;
    if v_antes is null then
      raise exception 'Dependência não é desta obra' using errcode = '23503';
    end if;
    update public.obra_dependencia set defasagem_du = v_novo
    where obra_id = p_obra_id and atividade_id = v_atv
      and predecessora_id = (v_item->>'predecessora_id')::uuid;
    insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
    values (v_atv, 'plano_recuperacao', v_pessoa,
            jsonb_build_object('predecessora_id', v_item->>'predecessora_id', 'defasagem_du', v_antes),
            jsonb_build_object('predecessora_id', v_item->>'predecessora_id', 'defasagem_du', v_novo));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_tarefas, '[]')) loop
    v_atv := (v_item->>'atividade_id')::uuid;
    if not exists (
      select 1 from public.obra_atividade where id = v_atv and obra_id = p_obra_id
    ) then
      raise exception 'Atividade não é desta obra' using errcode = '23503';
    end if;
    insert into public.tarefa (obra_id, texto, prazo, vinculo_tipo, vinculo_id, origem_texto)
    values (p_obra_id, v_item->>'texto', (v_item->>'prazo')::date, 'atividade', v_atv,
            'Plano de recuperação')
    returning id into v_tarefa;
    insert into public.tarefa_evento (tarefa_id, tipo, por) values (v_tarefa, 'criada', v_pessoa);
  end loop;
end;
$$;

drop policy obra_mapa_libera_ins on obra_mapa_libera;
drop policy obra_mapa_libera_del on obra_mapa_libera;
create policy obra_mapa_libera_ins on obra_mapa_libera for insert to authenticated
  with check (contro_planeja_obra(obra_id));
create policy obra_mapa_libera_del on obra_mapa_libera for delete to authenticated
  using (contro_planeja_obra(obra_id));

drop policy mapa_proposta_ins on mapa_proposta;
drop policy mapa_proposta_upd on mapa_proposta;
create policy mapa_proposta_ins on mapa_proposta for insert to authenticated
  with check (contro_planeja_obra(obra_id) and criado_por = auth.uid());
create policy mapa_proposta_upd on mapa_proposta for update to authenticated
  using (contro_planeja_obra(obra_id)) with check (contro_planeja_obra(obra_id));
