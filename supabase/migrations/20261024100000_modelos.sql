-- M1 · Modelos de obra (vários, sem versões). Editar um modelo nunca altera
-- obras já criadas. Exclusão lógica. Dependência entre quaisquer fases, sem ciclo.

create table modelo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  subtitulo text,
  ordem int not null default 0,
  criado_de_id uuid references modelo (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz
);
create trigger modelo_set_updated_at before update on modelo
  for each row execute function set_updated_at();

create table modelo_fase (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references modelo (id) on delete cascade,
  ordem int not null,
  titulo text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on modelo_fase (modelo_id, ordem);
create trigger modelo_fase_set_updated_at before update on modelo_fase
  for each row execute function set_updated_at();

create table modelo_atividade (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references modelo (id) on delete cascade,
  fase_id uuid not null references modelo_fase (id) on delete cascade,
  ordem int not null,
  nome text not null,
  duracao_du int not null default 1 check (duracao_du >= 1),
  pai_id uuid references modelo_atividade (id) on delete cascade, -- preenchido = subitem (um nível)
  em_sequencia boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on modelo_atividade (modelo_id, fase_id, ordem);
create index on modelo_atividade (pai_id);
create trigger modelo_atividade_set_updated_at before update on modelo_atividade
  for each row execute function set_updated_at();

-- Subitem só tem um nível: o pai não pode ser, ele mesmo, um subitem.
create or replace function obdc_subitem_um_nivel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pai_id is not null then
    if exists (select 1 from public.modelo_atividade p where p.id = new.pai_id and p.pai_id is not null) then
      raise exception 'Subitem só pode ter um nível' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger modelo_atividade_um_nivel before insert or update on modelo_atividade
  for each row execute function obdc_subitem_um_nivel();

create table modelo_dependencia (
  modelo_id uuid not null references modelo (id) on delete cascade,
  atividade_id uuid not null references modelo_atividade (id) on delete cascade,
  predecessora_id uuid not null references modelo_atividade (id) on delete cascade,
  primary key (atividade_id, predecessora_id),
  check (atividade_id <> predecessora_id)
);
create index on modelo_dependencia (modelo_id);

-- Trigger anti-ciclo: rejeita a dependência que fecharia um ciclo no modelo.
create or replace function obdc_checa_ciclo_dependencia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    with recursive anc as (
      select new.predecessora_id as id
      union
      select d.predecessora_id
      from public.modelo_dependencia d
      join anc on d.atividade_id = anc.id and d.modelo_id = new.modelo_id
    )
    select 1 from anc where id = new.atividade_id
  ) then
    raise exception 'Ciclo de dependências no modelo' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger modelo_dependencia_anti_ciclo before insert or update on modelo_dependencia
  for each row execute function obdc_checa_ciclo_dependencia();

create table modelo_providencia (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references modelo (id) on delete cascade,
  atividade_id uuid not null references modelo_atividade (id) on delete cascade,
  tipo text not null check (tipo in ('contratacao', 'locacao', 'compra')),
  descricao text not null,
  antecedencia_du int not null default 0 check (antecedencia_du >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on modelo_providencia (modelo_id, atividade_id);
create trigger modelo_providencia_set_updated_at before update on modelo_providencia
  for each row execute function set_updated_at();

-- RLS: só gestor escreve modelos; membro ativo (gestor ou equipe) lê, para
-- escolher o modelo ao criar a obra. A UI esconde a edição para a equipe.
alter table modelo enable row level security;
alter table modelo_fase enable row level security;
alter table modelo_atividade enable row level security;
alter table modelo_dependencia enable row level security;
alter table modelo_providencia enable row level security;

-- modelo (exclusão lógica: filtra deleted_at na leitura)
create policy modelo_sel on modelo
  for select to authenticated using (deleted_at is null and obdc_e_membro());
create policy modelo_ins on modelo
  for insert to authenticated with check (obdc_perfil() = 'gestor');
create policy modelo_upd on modelo
  for update to authenticated using (obdc_perfil() = 'gestor') with check (obdc_perfil() = 'gestor');

-- tabelas filhas: leitura para membro; escrita só gestor
do $$
declare t text;
begin
  foreach t in array array['modelo_fase','modelo_atividade','modelo_dependencia','modelo_providencia']
  loop
    execute format('create policy %I_sel on %I for select to authenticated using (obdc_e_membro());', t, t);
    execute format('create policy %I_ins on %I for insert to authenticated with check (obdc_perfil() = ''gestor'');', t, t);
    execute format('create policy %I_upd on %I for update to authenticated using (obdc_perfil() = ''gestor'') with check (obdc_perfil() = ''gestor'');', t, t);
    execute format('create policy %I_del on %I for delete to authenticated using (obdc_perfil() = ''gestor'');', t, t);
  end loop;
end $$;
