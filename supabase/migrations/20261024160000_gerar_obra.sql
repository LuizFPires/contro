-- M2 · gerar_obra: cria a obra como cópia independente do modelo escolhido.
-- Grava modelo_rotulo (nome · subtítulo no instante). Editar a obra depois não
-- afeta o modelo e vice-versa. SECURITY DEFINER + checagem de membro ativo.
create or replace function gerar_obra(
  p_unidade_id uuid,
  p_inicio date,
  p_nome text,
  p_modelo_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid := extensions.gen_random_uuid();
  v_rotulo text;
  v_pessoa uuid;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros podem criar obras' using errcode = '42501';
  end if;

  select nome || coalesce(' · ' || subtitulo, '') into v_rotulo
  from public.modelo where id = p_modelo_id and deleted_at is null;
  if v_rotulo is null then
    raise exception 'Modelo inválido' using errcode = '23503';
  end if;

  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;

  insert into public.obra (id, unidade_id, nome, inicio, modelo_id, modelo_rotulo, engenheiro_id)
  values (v_obra, p_unidade_id, p_nome, p_inicio, p_modelo_id, v_rotulo, v_pessoa);

  -- Fases
  insert into public.obra_fase (id, obra_id, ordem, titulo)
  select extensions.uuid_generate_v5(v_obra, f.id::text), v_obra, f.ordem, f.titulo
  from public.modelo_fase f
  where f.modelo_id = p_modelo_id;

  -- Atividades (pais antes dos subitens) com origem_modelo_atividade_id
  insert into public.obra_atividade (
    id, obra_id, fase_id, ordem, nome, duracao_du, origem_modelo_atividade_id, pai_id, em_sequencia
  )
  select extensions.uuid_generate_v5(v_obra, a.id::text), v_obra,
         extensions.uuid_generate_v5(v_obra, a.fase_id::text),
         a.ordem, a.nome, a.duracao_du, a.id,
         case when a.pai_id is null then null
              else extensions.uuid_generate_v5(v_obra, a.pai_id::text) end,
         a.em_sequencia
  from public.modelo_atividade a
  where a.modelo_id = p_modelo_id
  order by (a.pai_id is not null);

  -- Dependências
  insert into public.obra_dependencia (obra_id, atividade_id, predecessora_id)
  select v_obra,
         extensions.uuid_generate_v5(v_obra, d.atividade_id::text),
         extensions.uuid_generate_v5(v_obra, d.predecessora_id::text)
  from public.modelo_dependencia d
  where d.modelo_id = p_modelo_id;

  -- Providências (status pendente; na_obra_em null = início da atividade)
  insert into public.obra_providencia (
    id, obra_id, atividade_id, tipo, descricao, antecedencia_du
  )
  select extensions.uuid_generate_v5(v_obra, pr.id::text), v_obra,
         extensions.uuid_generate_v5(v_obra, pr.atividade_id::text),
         pr.tipo, pr.descricao, pr.antecedencia_du
  from public.modelo_providencia pr
  where pr.modelo_id = p_modelo_id;

  return v_obra;
end;
$$;
