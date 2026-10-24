-- M1 · RPCs de modelo (só gestor). Cópia profunda e exclusão lógica.
-- Edições granulares (renomear, duração, predecessora, providência) vão pelo
-- cliente sob RLS: os constraints e triggers (dur≥1, anti-ciclo, 1 nível, fase
-- com título) já validam no banco.

create extension if not exists "uuid-ossp" with schema extensions;

-- Duplica um modelo (cópia profunda) ou cria um em branco quando origem é null.
-- Retorna o id do novo modelo. SECURITY INVOKER: a RLS exige gestor para escrever.
create or replace function duplicar_modelo(
  p_origem uuid,
  p_nome text,
  p_subtitulo text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_new uuid := extensions.gen_random_uuid();
  v_ordem int;
begin
  if public.obdc_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor edita modelos' using errcode = '42501';
  end if;

  select coalesce(max(ordem), 0) + 1 into v_ordem from public.modelo where deleted_at is null;

  insert into public.modelo (id, nome, subtitulo, ordem, criado_de_id)
  values (v_new, p_nome, p_subtitulo, v_ordem, p_origem);

  if p_origem is null then
    return v_new; -- modelo em branco
  end if;

  -- Fases
  insert into public.modelo_fase (id, modelo_id, ordem, titulo)
  select extensions.uuid_generate_v5(v_new, f.id::text), v_new, f.ordem, f.titulo
  from public.modelo_fase f
  where f.modelo_id = p_origem;

  -- Atividades (pais antes dos subitens, para o trigger de 1 nível)
  insert into public.modelo_atividade (id, modelo_id, fase_id, ordem, nome, duracao_du, pai_id, em_sequencia)
  select extensions.uuid_generate_v5(v_new, a.id::text), v_new,
         extensions.uuid_generate_v5(v_new, a.fase_id::text),
         a.ordem, a.nome, a.duracao_du,
         case when a.pai_id is null then null
              else extensions.uuid_generate_v5(v_new, a.pai_id::text) end,
         a.em_sequencia
  from public.modelo_atividade a
  where a.modelo_id = p_origem
  order by (a.pai_id is not null);

  -- Dependências
  insert into public.modelo_dependencia (modelo_id, atividade_id, predecessora_id)
  select v_new,
         extensions.uuid_generate_v5(v_new, d.atividade_id::text),
         extensions.uuid_generate_v5(v_new, d.predecessora_id::text)
  from public.modelo_dependencia d
  where d.modelo_id = p_origem;

  -- Providências
  insert into public.modelo_providencia (id, modelo_id, atividade_id, tipo, descricao, antecedencia_du)
  select extensions.uuid_generate_v5(v_new, pr.id::text), v_new,
         extensions.uuid_generate_v5(v_new, pr.atividade_id::text),
         pr.tipo, pr.descricao, pr.antecedencia_du
  from public.modelo_providencia pr
  where pr.modelo_id = p_origem;

  return v_new;
end;
$$;

-- Exclusão lógica, mantendo ao menos um modelo ativo.
create or replace function excluir_modelo(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if public.obdc_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor edita modelos' using errcode = '42501';
  end if;
  if (select count(*) from public.modelo where deleted_at is null) <= 1 then
    raise exception 'É preciso manter ao menos um modelo ativo' using errcode = '23514';
  end if;
  update public.modelo set deleted_at = now() where id = p_id and deleted_at is null;
end;
$$;
