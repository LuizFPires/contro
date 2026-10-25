-- M2 · Obra (cópia independente do modelo). Exclusão lógica + tabela de eventos.
-- RLS: membro ativo (gestor ou equipe) lê e escreve as tabelas de obra.

create type obra_status as enum ('ativa', 'concluida', 'pausada');

create table obra (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  nome text not null,
  inicio date not null,
  modelo_id uuid references modelo (id),
  modelo_rotulo text not null, -- nome · subtítulo no momento da criação
  engenheiro_id uuid references pessoa (id),
  status obra_status not null default 'ativa',
  xp int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz
);
create trigger obra_set_updated_at before update on obra
  for each row execute function set_updated_at();

create table obra_fase (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obra (id) on delete cascade,
  ordem int not null,
  titulo text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on obra_fase (obra_id, ordem);
create trigger obra_fase_set_updated_at before update on obra_fase
  for each row execute function set_updated_at();

-- foto antes de obra_atividade (que referencia foto_conclusao_id)
create table foto (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obra (id) on delete cascade,
  storage_path text not null,
  largura int,
  altura int,
  tirada_em timestamptz not null default now(),
  tirada_por uuid references pessoa (id),
  lat double precision,
  lng double precision,
  sha256 text,
  created_at timestamptz not null default now()
);
create index on foto (obra_id);

create table obra_atividade (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obra (id) on delete cascade,
  fase_id uuid not null references obra_fase (id) on delete cascade,
  ordem int not null,
  nome text not null,
  duracao_du int not null default 1 check (duracao_du >= 1),
  origem_modelo_atividade_id uuid,
  pai_id uuid references obra_atividade (id) on delete cascade,
  em_sequencia boolean not null default true,
  inicio_manual date,
  concluida_em timestamptz,
  concluida_por uuid references pessoa (id),
  foto_conclusao_id uuid references foto (id),
  prestador text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz
);
create index on obra_atividade (obra_id, fase_id, ordem);
create index on obra_atividade (pai_id);
create trigger obra_atividade_set_updated_at before update on obra_atividade
  for each row execute function set_updated_at();

create table obra_dependencia (
  obra_id uuid not null references obra (id) on delete cascade,
  atividade_id uuid not null references obra_atividade (id) on delete cascade,
  predecessora_id uuid not null references obra_atividade (id) on delete cascade,
  primary key (atividade_id, predecessora_id),
  check (atividade_id <> predecessora_id)
);
create index on obra_dependencia (obra_id);

create table obra_providencia (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obra (id) on delete cascade,
  atividade_id uuid not null references obra_atividade (id) on delete cascade,
  tipo text not null check (tipo in ('contratacao', 'locacao', 'compra')),
  descricao text not null,
  antecedencia_du int not null default 0 check (antecedencia_du >= 0),
  na_obra_em date,
  status text not null default 'pendente' check (status in ('pendente', 'feito')),
  feito_em timestamptz,
  feito_por uuid references pessoa (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on obra_providencia (obra_id, atividade_id);
create trigger obra_providencia_set_updated_at before update on obra_providencia
  for each row execute function set_updated_at();

-- Eventos de atividade (exclusão lógica + rastro — regra 7)
create table obra_atividade_evento (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references obra_atividade (id) on delete cascade,
  tipo text not null, -- 'inicio_ajustado' | 'concluida' | 'reaberta' | 'subitem'
  por uuid references pessoa (id),
  em timestamptz not null default now(),
  antes jsonb,
  depois jsonb
);
create index on obra_atividade_evento (atividade_id, em);

-- RLS: membro ativo lê e escreve todas as tabelas de obra (gestor e equipe).
alter table obra enable row level security;
alter table obra_fase enable row level security;
alter table foto enable row level security;
alter table obra_atividade enable row level security;
alter table obra_dependencia enable row level security;
alter table obra_providencia enable row level security;
alter table obra_atividade_evento enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'obra','obra_fase','foto','obra_atividade','obra_dependencia','obra_providencia','obra_atividade_evento'
  ]
  loop
    execute format('create policy %I_sel on %I for select to authenticated using (contro_e_membro());', t, t);
    execute format('create policy %I_ins on %I for insert to authenticated with check (contro_e_membro());', t, t);
    execute format('create policy %I_upd on %I for update to authenticated using (contro_e_membro()) with check (contro_e_membro());', t, t);
  end loop;
end $$;
