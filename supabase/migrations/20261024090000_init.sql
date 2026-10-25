-- M0 · Cadastros base: pessoa, unidade, sugestao + RLS
-- Sem cadastro de feriados (decisão do produto). Exclusão lógica via deleted_at.

create type perfil as enum ('gestor', 'equipe');

-- updated_at automático
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- pessoa (vincula a auth.users; papel_texto é só rótulo)
create table pessoa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete cascade,
  nome text not null,
  papel_texto text,
  perfil perfil not null default 'equipe',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz
);
create trigger pessoa_set_updated_at before update on pessoa
  for each row execute function set_updated_at();

create table unidade (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz
);
create trigger unidade_set_updated_at before update on unidade
  for each row execute function set_updated_at();

-- sugestao: autocompletar alimentado pelo uso (cadastro pelo uso)
create table sugestao (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('pessoa', 'prestador', 'local')),
  texto text not null,
  usos int not null default 1,
  ultimo_uso timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tipo, texto)
);

-- Perfil do usuário atual (security definer evita recursão de RLS em pessoa)
create or replace function contro_perfil()
returns perfil
language sql
stable
security definer
set search_path = ''
as $$
  select p.perfil
  from public.pessoa p
  where p.user_id = auth.uid() and p.deleted_at is null and p.ativo
  limit 1;
$$;

-- Membro ativo = tem pessoa não excluída e ativa (gestor ou equipe).
create or replace function contro_e_membro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pessoa p
    where p.user_id = auth.uid() and p.deleted_at is null and p.ativo
  );
$$;

-- RLS: dois perfis (gestor escreve cadastros; equipe lê)
alter table pessoa enable row level security;
alter table unidade enable row level security;
alter table sugestao enable row level security;

-- pessoa (só membros ativos leem; só gestor escreve)
create policy pessoa_sel on pessoa
  for select to authenticated using (deleted_at is null and contro_e_membro());
create policy pessoa_ins on pessoa
  for insert to authenticated with check (contro_perfil() = 'gestor');
create policy pessoa_upd on pessoa
  for update to authenticated
  using (contro_perfil() = 'gestor') with check (contro_perfil() = 'gestor');

-- unidade
create policy unidade_sel on unidade
  for select to authenticated using (deleted_at is null and contro_e_membro());
create policy unidade_ins on unidade
  for insert to authenticated with check (contro_perfil() = 'gestor');
create policy unidade_upd on unidade
  for update to authenticated
  using (contro_perfil() = 'gestor') with check (contro_perfil() = 'gestor');

-- sugestao: membro ativo lê e escreve (cadastro pelo uso); sem exclusão
create policy sugestao_sel on sugestao
  for select to authenticated using (contro_e_membro());
create policy sugestao_ins on sugestao
  for insert to authenticated with check (contro_e_membro());
create policy sugestao_upd on sugestao
  for update to authenticated using (contro_e_membro()) with check (contro_e_membro());

-- Nota: o primeiro gestor é criado fora da RLS (service role / seed de homologação),
-- pois nenhum gestor existe ainda para satisfazer contro_perfil() = 'gestor'.
