-- M6 · Tarefas ("quem faz o quê, até quando"). Replanejamento rastreado (regra 8),
-- efeitos de vínculo (lembrete → providenciado), exclusão lógica + evento (regra 7).
-- Escrita só por RPC (SECURITY DEFINER); cliente só LÊ (como pendência).

create table tarefa (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obra (id) on delete cascade,
  texto text not null,
  responsavel_id uuid references pessoa (id),
  prazo date not null,
  prazo_original date,
  replanejamentos int not null default 0,
  status text not null default 'aberta' check (status in ('aberta', 'feita')),
  feita_em timestamptz,
  feita_por uuid references pessoa (id),
  origem_reuniao_id uuid,            -- FK para reuniao entra no M7
  origem_texto text,
  vinculo_tipo text check (vinculo_tipo in ('providencia', 'atividade')),
  vinculo_id uuid,                    -- polimórfico (providência ou atividade)
  efeito_providencia_id uuid references obra_providencia (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on tarefa (obra_id, status);
create index on tarefa (responsavel_id);
create trigger tarefa_set_updated_at before update on tarefa
  for each row execute function set_updated_at();

create table tarefa_evento (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefa (id) on delete cascade,
  tipo text not null, -- 'criada'|'editada'|'replanejada'|'concluida'|'reaberta'|'excluida'|'restaurada'
  por uuid references pessoa (id),
  em timestamptz not null default now(),
  antes jsonb,
  depois jsonb
);
create index on tarefa_evento (tarefa_id, em);

alter table tarefa enable row level security;
alter table tarefa_evento enable row level security;
create policy tarefa_sel on tarefa for select to authenticated using (contro_e_membro());
create policy tarefa_evento_sel on tarefa_evento for select to authenticated using (contro_e_membro());

-- Cria ou edita. p_id nulo = nova. Editar o prazo de tarefa aberta replaneja
-- (preserva prazo_original e incrementa replanejamentos) — regra 8.
create or replace function salvar_tarefa(
  p_id uuid,
  p_obra_id uuid,
  p_texto text,
  p_responsavel_id uuid,
  p_prazo date,
  p_vinculo_tipo text default null,
  p_vinculo_id uuid default null,
  p_origem_texto text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_id uuid; v_old public.tarefa;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if coalesce(trim(p_texto), '') = '' then
    raise exception 'Texto obrigatório' using errcode = '23514';
  end if;
  if p_prazo is null then
    raise exception 'Prazo obrigatório' using errcode = '23514';
  end if;
  v_pessoa := public.contro_pessoa_atual();

  if p_id is null then
    -- O vínculo tem de ser da MESMA obra (evita efeito cruzado entre obras).
    if p_vinculo_tipo = 'providencia' and not exists (
      select 1 from public.obra_providencia where id = p_vinculo_id and obra_id = p_obra_id
    ) then
      raise exception 'Vínculo (providência) não é desta obra' using errcode = '23503';
    end if;
    if p_vinculo_tipo = 'atividade' and not exists (
      select 1 from public.obra_atividade where id = p_vinculo_id and obra_id = p_obra_id
    ) then
      raise exception 'Vínculo (atividade) não é desta obra' using errcode = '23503';
    end if;
    insert into public.tarefa (obra_id, texto, responsavel_id, prazo, vinculo_tipo, vinculo_id, origem_texto)
    values (p_obra_id, p_texto, p_responsavel_id, p_prazo, p_vinculo_tipo, p_vinculo_id, p_origem_texto)
    returning id into v_id;
    insert into public.tarefa_evento (tarefa_id, tipo, por) values (v_id, 'criada', v_pessoa);
    return v_id;
  end if;

  select * into v_old from public.tarefa where id = p_id and deleted_at is null;
  if v_old.id is null then
    raise exception 'Tarefa inválida' using errcode = '23503';
  end if;

  if v_old.status = 'aberta' and p_prazo is distinct from v_old.prazo then
    update public.tarefa
    set texto = p_texto, responsavel_id = p_responsavel_id, prazo = p_prazo,
        prazo_original = coalesce(prazo_original, v_old.prazo),
        replanejamentos = replanejamentos + 1
    where id = p_id;
    insert into public.tarefa_evento (tarefa_id, tipo, por, antes, depois)
    values (p_id, 'replanejada', v_pessoa,
            jsonb_build_object('prazo', v_old.prazo),
            jsonb_build_object('prazo', p_prazo));
  else
    update public.tarefa
    set texto = p_texto, responsavel_id = p_responsavel_id, prazo = p_prazo
    where id = p_id;
    insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'editada', v_pessoa);
  end if;
  return p_id;
end;
$$;

-- Conclui. Vínculo 'providencia' marca a providência feito e guarda o efeito
-- (para reabrir). Vínculo 'atividade' é concluído pela câmera na UI (regra 3).
create or replace function concluir_tarefa(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_t public.tarefa;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select * into v_t from public.tarefa where id = p_id and deleted_at is null;
  if v_t.id is null then
    raise exception 'Tarefa inválida' using errcode = '23503';
  end if;
  v_pessoa := public.contro_pessoa_atual();

  if v_t.vinculo_tipo = 'providencia' and v_t.vinculo_id is not null then
    update public.obra_providencia
    set status = 'feito', feito_em = now(), feito_por = v_pessoa
    where id = v_t.vinculo_id and obra_id = v_t.obra_id and status = 'pendente';
    if found then
      update public.tarefa set efeito_providencia_id = v_t.vinculo_id where id = p_id;
    end if;
  end if;

  update public.tarefa set status = 'feita', feita_em = now(), feita_por = v_pessoa where id = p_id;
  insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'concluida', v_pessoa);
end;
$$;

-- Reabre. Desfaz o efeito no lembrete se a atividade dele NÃO foi concluída.
create or replace function reabrir_tarefa(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_t public.tarefa; v_atv_concluida boolean;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select * into v_t from public.tarefa where id = p_id and deleted_at is null;
  if v_t.id is null then
    raise exception 'Tarefa inválida' using errcode = '23503';
  end if;
  v_pessoa := public.contro_pessoa_atual();

  if v_t.efeito_providencia_id is not null then
    select oa.concluida_em is not null into v_atv_concluida
    from public.obra_providencia op
    join public.obra_atividade oa on oa.id = op.atividade_id
    where op.id = v_t.efeito_providencia_id and op.obra_id = v_t.obra_id;
    if not coalesce(v_atv_concluida, false) then
      update public.obra_providencia
      set status = 'pendente', feito_em = null, feito_por = null
      where id = v_t.efeito_providencia_id and obra_id = v_t.obra_id;
      update public.tarefa set efeito_providencia_id = null where id = p_id;
    end if;
  end if;

  update public.tarefa set status = 'aberta', feita_em = null, feita_por = null where id = p_id;
  insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'reaberta', v_pessoa);
end;
$$;

-- Exclusão lógica (com Desfazer via restaurar_tarefa).
create or replace function excluir_tarefa(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  v_pessoa := public.contro_pessoa_atual();
  update public.tarefa set deleted_at = now() where id = p_id and deleted_at is null;
  insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'excluida', v_pessoa);
end;
$$;

create or replace function restaurar_tarefa(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  v_pessoa := public.contro_pessoa_atual();
  update public.tarefa set deleted_at = null where id = p_id;
  insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'restaurada', v_pessoa);
end;
$$;
