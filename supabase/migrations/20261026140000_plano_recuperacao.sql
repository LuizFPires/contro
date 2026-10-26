-- Plano de recuperação da inauguração (opção A, decisão do usuário 26/10/2026).
--   - obra.entrega_original: a inauguração planejada, fixada uma vez (primeira
--     abertura da obra ou ao aplicar um plano). O cronograma é calculado no
--     cliente (core), por isso a data chega por RPC.
--   - obra_dependencia.defasagem_du (≤ 0): paralelismo; -2 = a atividade começa
--     2 dias úteis antes do fim da predecessora.
--   - aplicar_plano_recuperacao: grava reduções de prazo e paralelismos de uma
--     vez, com evento por atividade, e cria as providências (tarefas) do plano.

alter table obra add column entrega_original date;
alter table obra_dependencia
  add column defasagem_du int not null default 0 check (defasagem_du between -60 and 0);

-- Fixa a inauguração planejada só se ainda não houver (idempotente).
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
  if p_data is null then return; end if;
  update public.obra set entrega_original = p_data
  where id = p_obra_id and entrega_original is null and deleted_at is null;
end;
$$;

-- p_duracoes:   [{ "atividade_id": uuid, "duracao_du": int }]
-- p_defasagens: [{ "atividade_id": uuid, "predecessora_id": uuid, "defasagem_du": int }]
-- p_tarefas:    [{ "texto": text, "atividade_id": uuid, "prazo": date }]
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

revoke all on function fixar_entrega_original(uuid, date) from public, anon;
revoke all on function aplicar_plano_recuperacao(uuid, date, jsonb, jsonb, jsonb) from public, anon;
grant execute on function fixar_entrega_original(uuid, date) to authenticated;
grant execute on function aplicar_plano_recuperacao(uuid, date, jsonb, jsonb, jsonb) to authenticated;
