-- Lembrete de providência com DURAÇÃO (pedido do usuário, 27/10/2026): além do
-- prazo (antecedência antes da atividade), quantos dias úteis leva para
-- providenciar (ex.: tomada de preço de 5 du para contratar). O Hoje avisa desde
-- o dia de começar (prazo − duração) até o prazo. 0 = só o prazo (como antes).
-- Continua sem valor e sem fornecedor.
alter table modelo_providencia
  add column duracao_du int not null default 0 check (duracao_du >= 0);
alter table obra_providencia
  add column duracao_du int not null default 0 check (duracao_du >= 0);

-- gerar_obra e duplicar_modelo passam a copiar a duração (resto igual a 20261026160000).
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
  if not public.contro_e_membro() then
    raise exception 'Apenas membros podem criar obras' using errcode = '42501';
  end if;

  select nome || coalesce(' · ' || subtitulo, '') into v_rotulo
  from public.modelo where id = p_modelo_id and deleted_at is null;
  if v_rotulo is null then
    raise exception 'Modelo inválido' using errcode = '23503';
  end if;

  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;

  insert into public.obra (id, unidade_id, nome, inicio, modelo_id, modelo_rotulo, engenheiro_id, created_by)
  values (v_obra, p_unidade_id, p_nome, p_inicio, p_modelo_id, v_rotulo, v_pessoa, auth.uid());

  insert into public.obra_fase (id, obra_id, ordem, titulo, preliminar)
  select extensions.uuid_generate_v5(v_obra, f.id::text), v_obra, f.ordem, f.titulo, f.preliminar
  from public.modelo_fase f where f.modelo_id = p_modelo_id;

  insert into public.obra_atividade (
    id, obra_id, fase_id, ordem, nome, duracao_du, origem_modelo_atividade_id, pai_id, em_sequencia,
    mapa_antecedencia_du
  )
  select extensions.uuid_generate_v5(v_obra, a.id::text), v_obra,
         extensions.uuid_generate_v5(v_obra, a.fase_id::text),
         a.ordem, a.nome, a.duracao_du, a.id,
         case when a.pai_id is null then null
              else extensions.uuid_generate_v5(v_obra, a.pai_id::text) end,
         a.em_sequencia,
         a.mapa_antecedencia_du
  from public.modelo_atividade a
  where a.modelo_id = p_modelo_id
  order by (a.pai_id is not null);

  insert into public.obra_dependencia (obra_id, atividade_id, predecessora_id)
  select v_obra,
         extensions.uuid_generate_v5(v_obra, d.atividade_id::text),
         extensions.uuid_generate_v5(v_obra, d.predecessora_id::text)
  from public.modelo_dependencia d where d.modelo_id = p_modelo_id;

  insert into public.obra_providencia (id, obra_id, atividade_id, tipo, descricao, antecedencia_du, duracao_du)
  select extensions.uuid_generate_v5(v_obra, pr.id::text), v_obra,
         extensions.uuid_generate_v5(v_obra, pr.atividade_id::text),
         pr.tipo, pr.descricao, pr.antecedencia_du, pr.duracao_du
  from public.modelo_providencia pr where pr.modelo_id = p_modelo_id;

  insert into public.obra_mapa_libera (obra_id, mapa_id, atividade_id)
  select v_obra,
         extensions.uuid_generate_v5(v_obra, l.mapa_id::text),
         extensions.uuid_generate_v5(v_obra, l.atividade_id::text)
  from public.modelo_mapa_libera l where l.modelo_id = p_modelo_id;

  return v_obra;
end;
$$;

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
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor edita modelos' using errcode = '42501';
  end if;

  select coalesce(max(ordem), 0) + 1 into v_ordem from public.modelo where deleted_at is null;

  insert into public.modelo (id, nome, subtitulo, ordem, criado_de_id)
  values (v_new, p_nome, p_subtitulo, v_ordem, p_origem);

  if p_origem is null then
    return v_new; -- modelo em branco
  end if;

  -- Fases
  insert into public.modelo_fase (id, modelo_id, ordem, titulo, preliminar)
  select extensions.uuid_generate_v5(v_new, f.id::text), v_new, f.ordem, f.titulo, f.preliminar
  from public.modelo_fase f
  where f.modelo_id = p_origem;

  -- Atividades (pais antes dos subitens, para o trigger de 1 nível)
  insert into public.modelo_atividade (
    id, modelo_id, fase_id, ordem, nome, duracao_du, pai_id, em_sequencia,
    mapa_antecedencia_du
  )
  select extensions.uuid_generate_v5(v_new, a.id::text), v_new,
         extensions.uuid_generate_v5(v_new, a.fase_id::text),
         a.ordem, a.nome, a.duracao_du,
         case when a.pai_id is null then null
              else extensions.uuid_generate_v5(v_new, a.pai_id::text) end,
         a.em_sequencia,
         a.mapa_antecedencia_du
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
  insert into public.modelo_providencia (id, modelo_id, atividade_id, tipo, descricao, antecedencia_du, duracao_du)
  select extensions.uuid_generate_v5(v_new, pr.id::text), v_new,
         extensions.uuid_generate_v5(v_new, pr.atividade_id::text),
         pr.tipo, pr.descricao, pr.antecedencia_du, pr.duracao_du
  from public.modelo_providencia pr
  where pr.modelo_id = p_origem;

  -- O que cada mapa de coleta libera
  insert into public.modelo_mapa_libera (modelo_id, mapa_id, atividade_id)
  select v_new,
         extensions.uuid_generate_v5(v_new, l.mapa_id::text),
         extensions.uuid_generate_v5(v_new, l.atividade_id::text)
  from public.modelo_mapa_libera l
  where l.modelo_id = p_origem;

  return v_new;
end;
$$;
