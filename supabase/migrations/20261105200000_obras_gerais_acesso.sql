-- Obras gerais · Etapa 1: ambiente da obra, papéis e acesso por obra.
-- Contorno não muda: pessoas de hoje ficam com acesso_contorno = true.

alter table obra
  add column ambiente text not null default 'contorno' check (ambiente in ('contorno','geral')),
  add column cidade text;

alter table pessoa
  add column administrador boolean not null default false,
  add column acesso_contorno boolean not null default true,
  add column papel_geral text null check (papel_geral in ('coordenador','membro'));

create table obra_participante (
  obra_id uuid not null references obra(id),
  pessoa_id uuid not null references pessoa(id),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  primary key (obra_id, pessoa_id)
);
create index obra_participante_pessoa_idx on obra_participante (pessoa_id);

create table convite_geral (
  email text primary key check (email = lower(btrim(email))),
  nome text not null,
  papel text not null check (papel in ('coordenador','membro')),
  obra_ids uuid[] not null default '{}',
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  usado_em timestamptz
);

create or replace function contro_e_membro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pessoa p
    where p.user_id = auth.uid() and p.deleted_at is null and p.ativo and p.acesso_contorno
  );
$$;

create or replace function contro_e_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pessoa p
    where p.user_id = auth.uid() and p.deleted_at is null and p.ativo and p.administrador
  );
$$;

create or replace function contro_ve_obra(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.obra o
    where o.id = p_obra_id and o.deleted_at is null
      and (
        (o.ambiente = 'contorno' and public.contro_e_membro())
        or (o.ambiente = 'geral' and (
          public.contro_e_admin()
          or exists (
            select 1 from public.obra_participante op
            join public.pessoa p on p.id = op.pessoa_id
            where op.obra_id = o.id and p.user_id = auth.uid()
              and p.deleted_at is null and p.ativo
          )
        ))
      )
  );
$$;

create or replace function contro_coordena_obra(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.obra o
    where o.id = p_obra_id and o.deleted_at is null and o.ambiente = 'geral'
      and (
        public.contro_e_admin()
        or exists (
          select 1 from public.obra_participante op
          join public.pessoa p on p.id = op.pessoa_id
          where op.obra_id = o.id and p.user_id = auth.uid()
            and p.deleted_at is null and p.ativo and p.papel_geral = 'coordenador'
        )
      )
  );
$$;

create or replace function contro_tem_acesso()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.contro_e_membro() or public.contro_e_admin() or exists (
    select 1 from public.pessoa p
    where p.user_id = auth.uid() and p.deleted_at is null and p.ativo and p.papel_geral is not null
  );
$$;

grant execute on function contro_e_admin(), contro_ve_obra(uuid), contro_coordena_obra(uuid), contro_tem_acesso() to authenticated;

alter table obra_participante enable row level security;
alter table convite_geral enable row level security;
create policy obra_participante_sel on obra_participante for select to authenticated
  using (contro_ve_obra(obra_id));
create policy convite_geral_sel on convite_geral for select to authenticated
  using (contro_e_admin());

update pessoa set administrador = true
where perfil = 'gestor' and deleted_at is null
  and split_part(lower(btrim(nome)), ' ', 1) in ('luiz','rafael','rodrigo');
