-- Mapa de coleta libera VÁRIAS atividades (pedido do usuário, 26/10/2026): ex.:
-- o empreiteiro civil libera mobilização, demolições, limpeza, alvenarias,
-- impermeabilização e contrapiso. O mapa termina antes da mais cedo delas
-- (menor ES − antecedência). Só aviso: nada trava.
--   - modelo_mapa_libera / obra_mapa_libera (mapa → atividades que libera);
--   - as ligações atuais (mapa_alvo_id) entram na tabela e a coluna sai;
--   - a proposta de ligações é aplicada em todos os modelos e obras (por nome);
--   - gerar_obra e duplicar_modelo copiam as ligações.

create table modelo_mapa_libera (
  modelo_id uuid not null references modelo (id) on delete cascade,
  mapa_id uuid not null references modelo_atividade (id) on delete cascade,
  atividade_id uuid not null references modelo_atividade (id) on delete cascade,
  primary key (mapa_id, atividade_id),
  check (mapa_id <> atividade_id)
);
create index on modelo_mapa_libera (modelo_id);

create table obra_mapa_libera (
  obra_id uuid not null references obra (id) on delete cascade,
  mapa_id uuid not null references obra_atividade (id) on delete cascade,
  atividade_id uuid not null references obra_atividade (id) on delete cascade,
  primary key (mapa_id, atividade_id),
  check (mapa_id <> atividade_id)
);
create index on obra_mapa_libera (obra_id);

alter table modelo_mapa_libera enable row level security;
alter table obra_mapa_libera enable row level security;
-- Modelo: membro lê, só gestor edita (regra 11). Obra: membro lê e edita.
create policy modelo_mapa_libera_sel on modelo_mapa_libera for select to authenticated using (contro_e_membro());
create policy modelo_mapa_libera_ins on modelo_mapa_libera for insert to authenticated with check (contro_perfil() = 'gestor');
create policy modelo_mapa_libera_del on modelo_mapa_libera for delete to authenticated using (contro_perfil() = 'gestor');
create policy obra_mapa_libera_sel on obra_mapa_libera for select to authenticated using (contro_e_membro());
create policy obra_mapa_libera_ins on obra_mapa_libera for insert to authenticated with check (contro_e_membro());
create policy obra_mapa_libera_del on obra_mapa_libera for delete to authenticated using (contro_e_membro());

-- Ligações que já existem (uma por mapa).
insert into modelo_mapa_libera (modelo_id, mapa_id, atividade_id)
select modelo_id, id, mapa_alvo_id from modelo_atividade where mapa_alvo_id is not null
on conflict do nothing;
insert into obra_mapa_libera (obra_id, mapa_id, atividade_id)
select obra_id, id, mapa_alvo_id from obra_atividade where mapa_alvo_id is not null
on conflict do nothing;

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

  insert into public.obra_providencia (id, obra_id, atividade_id, tipo, descricao, antecedencia_du)
  select extensions.uuid_generate_v5(v_obra, pr.id::text), v_obra,
         extensions.uuid_generate_v5(v_obra, pr.atividade_id::text),
         pr.tipo, pr.descricao, pr.antecedencia_du
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
  insert into public.modelo_providencia (id, modelo_id, atividade_id, tipo, descricao, antecedencia_du)
  select extensions.uuid_generate_v5(v_new, pr.id::text), v_new,
         extensions.uuid_generate_v5(v_new, pr.atividade_id::text),
         pr.tipo, pr.descricao, pr.antecedencia_du
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

alter table modelo_atividade drop column mapa_alvo_id;
alter table obra_atividade drop column mapa_alvo_id;

-- Proposta de ligações (por nome; só onde o mapa e a atividade existem).
create or replace function contro_propor_libera_mapas()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  create temp table if not exists _libera (mapa text, alvo text) on commit drop;
  truncate _libera;
  insert into _libera values
    ('Equipamentos de ar-condicionado', 'Infra de ar-condicionado'),
    ('Equipamentos de ar-condicionado', 'Evaporadoras e start-up do ar'),
    ('Empreiteiro civil (global MO + material)', 'Mobilização e tapumes'),
    ('Empreiteiro civil (global MO + material)', 'Demolições e retiradas'),
    ('Empreiteiro civil (global MO + material)', 'Retiradas pontuais'),
    ('Empreiteiro civil (global MO + material)', 'Limpeza e bota-fora'),
    ('Empreiteiro civil (global MO + material)', 'Alvenarias e novos fechamentos'),
    ('Empreiteiro civil (global MO + material)', 'Impermeabilização dos vestiários'),
    ('Empreiteiro civil (global MO + material)', 'Contrapiso e regularização'),
    ('Ar-condicionado: instaladora e tubulação', 'Infra de ar-condicionado'),
    ('Ar-condicionado: instaladora e tubulação', 'Evaporadoras e start-up do ar'),
    ('Incêndio: empresa de sprinkler e materiais', 'Infra de incêndio'),
    ('Locações da mobilização', 'Mobilização e tapumes'),
    ('Locações da mobilização', 'Demolições e retiradas'),
    ('Locações da mobilização', 'Retiradas pontuais'),
    ('Locações da mobilização', 'Limpeza e bota-fora'),
    ('Elétrica: eletricista e materiais', 'Infra de elétrica'),
    ('Elétrica: eletricista e materiais', 'Infra de dados, CFTV e som'),
    ('Elétrica: eletricista e materiais', 'Luminárias e acabamento elétrico'),
    ('Elétrica: eletricista e materiais', 'Catraca, CFTV e som'),
    ('Marmoraria: granito e pedras', 'Bancadas e divisórias'),
    ('Hidráulica: encanador e tubos', 'Água fria e esgoto'),
    ('Hidráulica: encanador e tubos', 'Louças e metais'),
    ('Drywall: placas', 'Fechamento em drywall'),
    ('Esquadrias de alumínio e vidraçaria', 'Esquadrias, vidros e espelhos'),
    ('Revestimento: porcelanato e azulejista', 'Revestimento cerâmico vestiários'),
    ('Forro: empreiteiro e materiais', 'Forro de gesso'),
    ('Enxoval CDC: equipamentos e mobiliário', 'Equipamentos de academia'),
    ('Luminárias', 'Luminárias e acabamento elétrico'),
    ('Pintura: pintor, massa e tintas', 'Emassamento'),
    ('Pintura: pintor, massa e tintas', 'Pintura'),
    ('Piso emborrachado e vinílico: material e instalador', 'Piso emborrachado e vinílico'),
    ('Comunicação visual e paisagismo', 'Comunicação visual e fachada'),
    ('Start-up do ar e caminhão munck', 'Evaporadoras e start-up do ar'),
    ('Start-up do ar e caminhão munck', 'Equipamentos de academia');

  insert into public.modelo_mapa_libera (modelo_id, mapa_id, atividade_id)
  select m.modelo_id, m.id, a.id
  from _libera l
  join public.modelo_atividade m on m.nome = l.mapa and m.pai_id is null and m.mapa_antecedencia_du is not null
  join public.modelo_atividade a on a.modelo_id = m.modelo_id and a.nome = l.alvo and a.pai_id is null
  on conflict do nothing;

  insert into public.obra_mapa_libera (obra_id, mapa_id, atividade_id)
  select m.obra_id, m.id, a.id
  from _libera l
  join public.obra_atividade m on m.nome = l.mapa and m.pai_id is null and m.mapa_antecedencia_du is not null
    and m.deleted_at is null
  join public.obra_atividade a on a.obra_id = m.obra_id and a.nome = l.alvo and a.pai_id is null
    and a.deleted_at is null
  on conflict do nothing;
end;
$$;

revoke all on function contro_propor_libera_mapas() from public, anon, authenticated;

select contro_propor_libera_mapas();

-- O pré-obra do seed de homologação passa a gravar só a antecedência;
-- as ligações vêm de contro_propor_libera_mapas().
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
    -- Orçamento: 3 atividades em sequência (#1 → #2 → #3), 5 du cada.
    v_atv := null;
    v_i := 0;
    foreach v_sub in array v_subs loop
      v_i := v_i + 1;
      insert into public.modelo_atividade (modelo_id, fase_id, ordem, nome, duracao_du, em_sequencia)
      values (r.id, v_fase, v_ordem - 200 + v_i, v_sub, 5, true) returning id into v_alvo;
      if v_atv is not null then
        insert into public.modelo_dependencia (modelo_id, atividade_id, predecessora_id)
        values (r.id, v_alvo, v_atv);
      end if;
      v_atv := v_alvo;
    end loop;

    insert into public.modelo_fase (modelo_id, ordem, titulo, preliminar)
    values (r.id, 2, 'Mapa de coleta', true) returning id into v_fase;
    for m in select * from _mapas order by n loop
      select id into v_alvo from public.modelo_atividade
      where modelo_id = r.id and pai_id is null and nome = m.alvo limit 1;
      continue when v_alvo is null;
      insert into public.modelo_atividade (
        modelo_id, fase_id, ordem, nome, duracao_du, em_sequencia, mapa_antecedencia_du
      ) values (r.id, v_fase, v_ordem - 100 + m.n, m.nome, 5, true, m.ant);
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
    -- Orçamento: 3 atividades em sequência (#1 → #2 → #3), 5 du cada.
    v_atv := null;
    v_i := 0;
    foreach v_sub in array v_subs loop
      v_i := v_i + 1;
      insert into public.obra_atividade (obra_id, fase_id, ordem, nome, duracao_du, em_sequencia)
      values (r.id, v_fase, v_ordem - 200 + v_i, v_sub, 5, true) returning id into v_alvo;
      if v_atv is not null then
        insert into public.obra_dependencia (obra_id, atividade_id, predecessora_id)
        values (r.id, v_alvo, v_atv);
      end if;
      v_atv := v_alvo;
    end loop;

    insert into public.obra_fase (obra_id, ordem, titulo, preliminar)
    values (r.id, 2, 'Mapa de coleta', true) returning id into v_fase;
    for m in select * from _mapas order by n loop
      select id into v_alvo from public.obra_atividade
      where obra_id = r.id and pai_id is null and deleted_at is null and nome = m.alvo limit 1;
      continue when v_alvo is null;
      insert into public.obra_atividade (
        obra_id, fase_id, ordem, nome, duracao_du, em_sequencia, mapa_antecedencia_du
      ) values (r.id, v_fase, v_ordem - 100 + m.n, m.nome, 5, true, m.ant);
    end loop;
  end loop;
end;
$$;

-- Orçamento (fase 1): os 3 subitens viram ATIVIDADES em sequência (#1, #2, #3)
-- e a atividade "Orçamento" sai (pedido do usuário, 26/10/2026). Obras: a
-- atividade-mãe sai por exclusão lógica (regra 7); o que já foi marcado fica.
do $$
declare r record; v_prev uuid; s record;
begin
  for r in
    select a.id, a.modelo_id from public.modelo_atividade a
    join public.modelo_fase f on f.id = a.fase_id and f.preliminar
    where a.pai_id is null and a.nome = 'Orçamento'
  loop
    v_prev := null;
    for s in select id from public.modelo_atividade where pai_id = r.id order by ordem loop
      update public.modelo_atividade set pai_id = null, ordem = ordem - 200 where id = s.id;
      if v_prev is not null then
        insert into public.modelo_dependencia (modelo_id, atividade_id, predecessora_id)
        values (r.modelo_id, s.id, v_prev) on conflict do nothing;
      end if;
      v_prev := s.id;
    end loop;
    delete from public.modelo_atividade where id = r.id;
  end loop;

  for r in
    select a.id, a.obra_id from public.obra_atividade a
    join public.obra_fase f on f.id = a.fase_id and f.preliminar
    where a.pai_id is null and a.nome = 'Orçamento' and a.deleted_at is null
  loop
    v_prev := null;
    for s in select id from public.obra_atividade where pai_id = r.id and deleted_at is null order by ordem loop
      update public.obra_atividade set pai_id = null, ordem = ordem - 200 where id = s.id;
      if v_prev is not null then
        insert into public.obra_dependencia (obra_id, atividade_id, predecessora_id)
        values (r.obra_id, s.id, v_prev) on conflict do nothing;
      end if;
      v_prev := s.id;
    end loop;
    update public.obra_atividade set deleted_at = now() where id = r.id;
  end loop;
end;
$$;
