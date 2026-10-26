-- Pré-obra (decisão do usuário, 26/10/2026): duas fases novas no início de
-- todos os modelos e obras, ANTES do dia 0 (início da Mobilização), fora do % e
-- do prazo da obra. As fases existentes são renumeradas (+2).
--   Fase 1 · Orçamento: atividade "Orçamento" com 3 subitens em sequência de
--     5 dias úteis (Recebimento dos projetos → Levantamento de quantitativos →
--     Montagem da EAP no Grana). Termina antes do primeiro mapa de coleta.
--   Fase 2 · Mapa de coleta: 18 mapas (tomadas de preço, 5 du cada), cada um
--     ligado à atividade da obra que libera e à antecedência da contratação:
--     termina em ES(alvo) − antecedência. Mapa cujo alvo não existe no modelo
--     não entra. Nas obras já criadas tudo entra ABERTO.
-- As datas do pré-obra são calculadas no cliente (core · cronogramaPreObra).

alter table modelo_fase add column preliminar boolean not null default false;
alter table obra_fase add column preliminar boolean not null default false;

alter table modelo_atividade
  add column mapa_alvo_id uuid references modelo_atividade (id) on delete set null,
  add column mapa_antecedencia_du int check (mapa_antecedencia_du >= 0);
alter table obra_atividade
  add column mapa_alvo_id uuid references obra_atividade (id) on delete set null,
  add column mapa_antecedencia_du int check (mapa_antecedencia_du >= 0);

-- Obra nova: copia também a marca de pré-obra e o alvo dos mapas.
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
    mapa_alvo_id, mapa_antecedencia_du
  )
  select extensions.uuid_generate_v5(v_obra, a.id::text), v_obra,
         extensions.uuid_generate_v5(v_obra, a.fase_id::text),
         a.ordem, a.nome, a.duracao_du, a.id,
         case when a.pai_id is null then null
              else extensions.uuid_generate_v5(v_obra, a.pai_id::text) end,
         a.em_sequencia,
         case when a.mapa_alvo_id is null then null
              else extensions.uuid_generate_v5(v_obra, a.mapa_alvo_id::text) end,
         a.mapa_antecedencia_du
  from public.modelo_atividade a
  where a.modelo_id = p_modelo_id
  order by (a.pai_id is not null);

  insert into public.obra_dependencia (obra_id, atividade_id, predecessora_id)
  select v_obra,
         extensions.uuid_generate_v5(v_obra, d.atividade_id::text),
         extensions.uuid_generate_v5(v_obra, d.predecessora_id::text)
  from public.modelo_dependencia d where d.modelo_id = p_modelo_id;

  insert into public.obra_providencia (id, obra_id, atividade_id, tipo, descricao, antecedencia_du)
  select extensions.uuid_generate_v5(v_obra, pr.id::text), v_obra,
         extensions.uuid_generate_v5(v_obra, pr.atividade_id::text),
         pr.tipo, pr.descricao, pr.antecedencia_du
  from public.modelo_providencia pr where pr.modelo_id = p_modelo_id;

  return v_obra;
end;
$$;

-- Duplicar modelo também copia o pré-obra (marca da fase e alvo dos mapas).
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
    mapa_alvo_id, mapa_antecedencia_du
  )
  select extensions.uuid_generate_v5(v_new, a.id::text), v_new,
         extensions.uuid_generate_v5(v_new, a.fase_id::text),
         a.ordem, a.nome, a.duracao_du,
         case when a.pai_id is null then null
              else extensions.uuid_generate_v5(v_new, a.pai_id::text) end,
         a.em_sequencia,
         case when a.mapa_alvo_id is null then null
              else extensions.uuid_generate_v5(v_new, a.mapa_alvo_id::text) end,
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
  insert into public.modelo_providencia (id, modelo_id, atividade_id, tipo, descricao, antecedencia_du)
  select extensions.uuid_generate_v5(v_new, pr.id::text), v_new,
         extensions.uuid_generate_v5(v_new, pr.atividade_id::text),
         pr.tipo, pr.descricao, pr.antecedencia_du
  from public.modelo_providencia pr
  where pr.modelo_id = p_origem;

  return v_new;
end;
$$;

-- Insere as fases do pré-obra onde ainda não houver (idempotente). Também é
-- chamada pelo seed de homologação (os modelos do seed chegam depois).
create or replace function contro_garantir_pre_obra()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  m record;
  v_fase uuid;
  v_atv uuid;
  v_alvo uuid;
  v_ordem int;
  v_i int;
  v_sub text;
  v_subs text[] := array[
    'Recebimento dos projetos',
    'Levantamento de quantitativos',
    'Montagem da EAP no Grana'
  ];
begin
  create temp table if not exists _mapas (n int, nome text, alvo text, ant int) on commit drop;
  truncate _mapas;
  insert into _mapas values
    (1, 'Equipamentos de ar-condicionado', 'Infra de ar-condicionado', 30),
    (2, 'Empreiteiro civil (global MO + material)', 'Mobilização e tapumes', 20),
    (3, 'Ar-condicionado: instaladora e tubulação', 'Infra de ar-condicionado', 10),
    (4, 'Incêndio: empresa de sprinkler e materiais', 'Infra de incêndio', 10),
    (5, 'Locações da mobilização', 'Mobilização e tapumes', 3),
    (6, 'Elétrica: eletricista e materiais', 'Infra de elétrica', 7),
    (7, 'Marmoraria: granito e pedras', 'Bancadas e divisórias', 25),
    (8, 'Hidráulica: encanador e tubos', 'Água fria e esgoto', 5),
    (9, 'Drywall: placas', 'Fechamento em drywall', 7),
    (10, 'Esquadrias de alumínio e vidraçaria', 'Esquadrias, vidros e espelhos', 30),
    (11, 'Revestimento: porcelanato e azulejista', 'Revestimento cerâmico vestiários', 10),
    (12, 'Forro: empreiteiro e materiais', 'Forro de gesso', 7),
    (13, 'Enxoval CDC: equipamentos e mobiliário', 'Equipamentos de academia', 30),
    (14, 'Luminárias', 'Luminárias e acabamento elétrico', 20),
    (15, 'Pintura: pintor, massa e tintas', 'Emassamento', 7),
    (16, 'Piso emborrachado e vinílico: material e instalador', 'Piso emborrachado e vinílico', 15),
    (17, 'Comunicação visual e paisagismo', 'Comunicação visual e fachada', 15),
    (18, 'Start-up do ar e caminhão munck', 'Evaporadoras e start-up do ar', 7);

  -- Modelos
  for r in
    select mo.id from public.modelo mo
    where not exists (
      select 1 from public.modelo_fase f where f.modelo_id = mo.id and f.preliminar
    )
  loop
    update public.modelo_fase set ordem = ordem + 2 where modelo_id = r.id;
    select coalesce(min(ordem), 1) into v_ordem from public.modelo_atividade where modelo_id = r.id;

    insert into public.modelo_fase (modelo_id, ordem, titulo, preliminar)
    values (r.id, 1, 'Orçamento', true) returning id into v_fase;
    insert into public.modelo_atividade (modelo_id, fase_id, ordem, nome, duracao_du, em_sequencia)
    values (r.id, v_fase, v_ordem - 100, 'Orçamento', 15, true) returning id into v_atv;
    v_i := 0;
    foreach v_sub in array v_subs loop
      v_i := v_i + 1;
      insert into public.modelo_atividade (modelo_id, fase_id, ordem, nome, duracao_du, pai_id, em_sequencia)
      values (r.id, v_fase, v_i, v_sub, 5, v_atv, true);
    end loop;

    insert into public.modelo_fase (modelo_id, ordem, titulo, preliminar)
    values (r.id, 2, 'Mapa de coleta', true) returning id into v_fase;
    for m in select * from _mapas order by n loop
      select id into v_alvo from public.modelo_atividade
      where modelo_id = r.id and pai_id is null and nome = m.alvo limit 1;
      continue when v_alvo is null;
      insert into public.modelo_atividade (
        modelo_id, fase_id, ordem, nome, duracao_du, em_sequencia, mapa_alvo_id, mapa_antecedencia_du
      ) values (r.id, v_fase, v_ordem - 100 + m.n, m.nome, 5, true, v_alvo, m.ant);
    end loop;
  end loop;

  -- Obras já criadas (cópias): mesma estrutura, aberta.
  for r in
    select o.id from public.obra o
    where not exists (
      select 1 from public.obra_fase f where f.obra_id = o.id and f.preliminar
    )
  loop
    update public.obra_fase set ordem = ordem + 2 where obra_id = r.id;
    select coalesce(min(ordem), 1) into v_ordem from public.obra_atividade where obra_id = r.id;

    insert into public.obra_fase (obra_id, ordem, titulo, preliminar)
    values (r.id, 1, 'Orçamento', true) returning id into v_fase;
    insert into public.obra_atividade (obra_id, fase_id, ordem, nome, duracao_du, em_sequencia)
    values (r.id, v_fase, v_ordem - 100, 'Orçamento', 15, true) returning id into v_atv;
    v_i := 0;
    foreach v_sub in array v_subs loop
      v_i := v_i + 1;
      insert into public.obra_atividade (obra_id, fase_id, ordem, nome, duracao_du, pai_id, em_sequencia)
      values (r.id, v_fase, v_i, v_sub, 5, v_atv, true);
    end loop;

    insert into public.obra_fase (obra_id, ordem, titulo, preliminar)
    values (r.id, 2, 'Mapa de coleta', true) returning id into v_fase;
    for m in select * from _mapas order by n loop
      select id into v_alvo from public.obra_atividade
      where obra_id = r.id and pai_id is null and deleted_at is null and nome = m.alvo limit 1;
      continue when v_alvo is null;
      insert into public.obra_atividade (
        obra_id, fase_id, ordem, nome, duracao_du, em_sequencia, mapa_alvo_id, mapa_antecedencia_du
      ) values (r.id, v_fase, v_ordem - 100 + m.n, m.nome, 5, true, v_alvo, m.ant);
    end loop;
  end loop;
end;
$$;

revoke all on function contro_garantir_pre_obra() from public, anon, authenticated;

select contro_garantir_pre_obra();
