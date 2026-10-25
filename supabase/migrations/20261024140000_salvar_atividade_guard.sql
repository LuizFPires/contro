-- Reforço defensivo: salvar_modelo_atividade valida que a fase e as
-- predecessoras pertencem ao mesmo modelo (evita vínculos cross-modelo que
-- escapariam do anti-ciclo, escopado por modelo_id).
create or replace function salvar_modelo_atividade(
  p_modelo_id uuid,
  p_fase_id uuid,
  p_nome text,
  p_duracao_du int,
  p_subitens jsonb default '[]'::jsonb,
  p_predecessoras uuid[] default '{}',
  p_providencias jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atv uuid := extensions.gen_random_uuid();
  v_ordem int;
  v_os int := 0;
  s jsonb;
  pr jsonb;
  p uuid;
begin
  if public.obdc_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor edita modelos' using errcode = '42501';
  end if;
  if coalesce(p_duracao_du, 0) < 1 then
    raise exception 'Duração deve ser ≥ 1' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.modelo_fase where id = p_fase_id and modelo_id = p_modelo_id
  ) then
    raise exception 'Fase não pertence ao modelo' using errcode = '23503';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_predecessoras, '{}')) pid
    where not exists (
      select 1 from public.modelo_atividade a
      where a.id = pid and a.modelo_id = p_modelo_id and a.pai_id is null
    )
  ) then
    raise exception 'Predecessora não pertence ao modelo' using errcode = '23503';
  end if;

  select coalesce(max(ordem), 0) + 1 into v_ordem
  from public.modelo_atividade
  where modelo_id = p_modelo_id and fase_id = p_fase_id and pai_id is null;

  insert into public.modelo_atividade (id, modelo_id, fase_id, ordem, nome, duracao_du)
  values (v_atv, p_modelo_id, p_fase_id, v_ordem, p_nome, p_duracao_du);

  for s in select * from jsonb_array_elements(coalesce(p_subitens, '[]'::jsonb))
  loop
    v_os := v_os + 1;
    insert into public.modelo_atividade (id, modelo_id, fase_id, ordem, nome, duracao_du, pai_id, em_sequencia)
    values (
      extensions.gen_random_uuid(), p_modelo_id, p_fase_id, v_os,
      s->>'nome', (s->>'duracao_du')::int, v_atv,
      coalesce((s->>'em_sequencia')::boolean, true)
    );
  end loop;

  foreach p in array coalesce(p_predecessoras, '{}')
  loop
    insert into public.modelo_dependencia (modelo_id, atividade_id, predecessora_id)
    values (p_modelo_id, v_atv, p)
    on conflict do nothing;
  end loop;

  for pr in select * from jsonb_array_elements(coalesce(p_providencias, '[]'::jsonb))
  loop
    insert into public.modelo_providencia (id, modelo_id, atividade_id, tipo, descricao, antecedencia_du)
    values (
      extensions.gen_random_uuid(), p_modelo_id, v_atv,
      pr->>'tipo', pr->>'descricao', coalesce((pr->>'antecedencia_du')::int, 0)
    );
  end loop;

  return v_atv;
end;
$$;
