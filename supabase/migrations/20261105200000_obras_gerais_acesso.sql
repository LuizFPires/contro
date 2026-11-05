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

-- contro_perfil(): quem não tem acesso à Contorno não passa nas políticas de gestor/equipe.
create or replace function contro_perfil()
returns perfil
language sql
stable
security definer
set search_path = ''
as $$
  select p.perfil
  from public.pessoa p
  where p.user_id = auth.uid() and p.deleted_at is null and p.ativo and p.acesso_contorno
  limit 1;
$$;

-- Defesa em profundidade: só RPC (security definer) escreve nas tabelas novas.
revoke insert, update, delete on obra_participante, convite_geral from anon, authenticated;

-- Campos de papel e acesso não podem ser escritos direto pelo cliente (PostgREST),
-- nem por gestor; o login (user_id) não muda e cadastro de administrador só é
-- alterado por administrador. RPCs security definer rodam como dono e passam.
create or replace function pessoa_protege_papeis()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.administrador is distinct from false
         or new.acesso_contorno is distinct from true
         or new.papel_geral is not null then
        raise exception 'campos de papel e acesso só mudam por função' using errcode = '42501';
      end if;
    elsif new.administrador is distinct from old.administrador
       or new.acesso_contorno is distinct from old.acesso_contorno
       or new.papel_geral is distinct from old.papel_geral then
      raise exception 'campos de papel e acesso só mudam por função' using errcode = '42501';
    elsif new.user_id is distinct from old.user_id then
      -- Trocar o login de um cadastro daria a alguém o papel de outra pessoa.
      raise exception 'o login da pessoa não muda' using errcode = '42501';
    elsif old.administrador and not public.contro_e_admin() then
      -- Cadastro de administrador só é alterado por administrador.
      raise exception 'só administrador altera cadastro de administrador' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger pessoa_protege_papeis_trg before insert or update on pessoa
  for each row execute function pessoa_protege_papeis();
