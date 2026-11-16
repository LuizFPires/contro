-- Avanço por quantitativo (pedido do usuário, 16/11/2026; protótipo aprovado
-- "CONTRO · Avanço por quantitativo").
--
-- Tudo nasce na ficha da atividade (sem menu novo na obra):
-- * a atividade pode receber um QUANTITATIVO (quantidade total, unidade e pessoas
--   previstas). A meta do dia é total ÷ dias úteis da atividade (core);
-- * com quantitativo, o avanço da atividade passa a ser o % MEDIDO, no lugar dos
--   passos 25 · 50 · 75 · 100. Sem quantitativo, nada muda;
-- * MEDIÇÃO: lançamento do dia ou de um período (de / até, dias úteis), com a
--   quantidade executada e as pessoas na frente (média por dia). Qualquer data até
--   hoje, inclusive antes do início previsto. Duas medições da mesma atividade não
--   se sobrepõem. Editável e excluível (exclusão lógica, com evento);
-- * a medição guarda o prestador da atividade na hora (histórico de produtividade
--   por prestador não muda se o prestador da atividade mudar depois).
-- Quem lança: todos que fazem o campo (Gestor, Coordenador e Equipe; nas obras
-- gerais, quem vê a obra), como o avanço parcial.

alter table obra_atividade
  add column quant_total numeric(14, 2) check (quant_total is null or quant_total > 0),
  add column quant_unidade text check (quant_unidade is null or quant_unidade in ('m²', 'm', 'm³', 'un', 'kg')),
  add column quant_pessoas smallint check (quant_pessoas is null or quant_pessoas between 1 and 999);

create table obra_medicao (
  -- Gerado no aparelho: a fila offline edita e exclui pelo mesmo id.
  id uuid primary key,
  obra_id uuid not null references obra (id) on delete cascade,
  atividade_id uuid not null references obra_atividade (id) on delete cascade,
  tipo text not null check (tipo in ('dia', 'periodo')),
  de date not null,
  ate date not null,
  quantidade numeric(14, 2) not null check (quantidade > 0),
  pessoas numeric(6, 1) not null check (pessoas > 0),
  prestador text,
  -- Foto opcional do lançamento (registro do que foi medido).
  foto_id uuid references foto (id),
  criado_por uuid references pessoa (id),
  criado_em timestamptz not null default now(),
  editado_por uuid references pessoa (id),
  editado_em timestamptz,
  deleted_at timestamptz,
  check (ate >= de),
  check (tipo = 'periodo' or de = ate)
);
create index on obra_medicao (atividade_id) where deleted_at is null;
create index on obra_medicao (obra_id) where deleted_at is null;

-- Leitura: quem vê a obra (mesmo isolamento das outras tabelas da obra).
-- Escrita só pelas RPCs abaixo (security definer).
alter table obra_medicao enable row level security;
create policy obra_medicao_select on obra_medicao for select to authenticated
  using (public.contro_ve_obra(obra_id));
grant select on obra_medicao to authenticated;

-- Recalcula o avanço da atividade aberta a partir das medições (0..99; chegar a
-- 100% é concluir, pelo caminho de sempre, feito pelo app).
create or replace function contro_recalcular_avanco_medido(p_atividade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric;
  v_soma numeric;
begin
  select quant_total into v_total from public.obra_atividade where id = p_atividade_id;
  if v_total is null then
    return;
  end if;
  select coalesce(sum(quantidade), 0) into v_soma
  from public.obra_medicao where atividade_id = p_atividade_id and deleted_at is null;
  update public.obra_atividade
  set avanco_pct = least(99, floor(v_soma * 100 / v_total))::smallint
  where id = p_atividade_id and concluida_em is null;
end;
$$;
revoke execute on function contro_recalcular_avanco_medido(uuid) from public, anon, authenticated;

-- Atividade de topo, aberta a quem faz o campo da obra. Devolve a obra.
create or replace function contro_atividade_de_campo(p_atividade_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select obra_id into v_obra
  from public.obra_atividade
  where id = p_atividade_id and deleted_at is null and pai_id is null
    and mapa_antecedencia_du is null;
  if v_obra is null then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  return v_obra;
end;
$$;
revoke execute on function contro_atividade_de_campo(uuid) from public, anon, authenticated;

-- Define (ou altera) o quantitativo da atividade. p_total null tira o
-- quantitativo: a atividade volta aos passos 25 · 50 · 75 · 100 (as medições
-- ficam guardadas).
create or replace function definir_quantitativo(
  p_atividade_id uuid,
  p_total numeric,
  p_unidade text,
  p_pessoas int,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_antes jsonb;
begin
  perform public.contro_atividade_de_campo(p_atividade_id);
  if p_total is not null and (p_total <= 0 or p_pessoas is null or p_pessoas < 1 or p_unidade is null) then
    raise exception 'Quantidade, unidade e pessoas são obrigatórias' using errcode = '22023';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;
  select jsonb_build_object('total', quant_total, 'unidade', quant_unidade, 'pessoas', quant_pessoas)
  into v_antes from public.obra_atividade where id = p_atividade_id for update;

  update public.obra_atividade
  set quant_total = p_total,
      quant_unidade = case when p_total is null then null else p_unidade end,
      quant_pessoas = case when p_total is null then null else p_pessoas end
  where id = p_atividade_id;

  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
  values (p_atividade_id, 'quantitativo', v_pessoa, v_antes,
          jsonb_build_object('total', p_total, 'unidade', p_unidade, 'pessoas', p_pessoas));
  perform public.contro_recalcular_avanco_medido(p_atividade_id);
end;
$$;
revoke execute on function definir_quantitativo(uuid, numeric, text, int, uuid) from public, anon;
grant execute on function definir_quantitativo(uuid, numeric, text, int, uuid) to authenticated;

-- Lança (id novo) ou corrige (id existente) uma medição.
create or replace function salvar_medicao(
  p_id uuid,
  p_atividade_id uuid,
  p_tipo text,
  p_de date,
  p_ate date,
  p_quantidade numeric,
  p_pessoas numeric,
  p_foto_id uuid default null,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid;
  v_pessoa uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_antes public.obra_medicao%rowtype;
  v_prestador text;
  v_unidade text;
begin
  v_obra := public.contro_atividade_de_campo(p_atividade_id);
  if p_id is null or p_tipo not in ('dia', 'periodo') or p_de is null or p_ate is null
     or p_ate < p_de or (p_tipo = 'dia' and p_de <> p_ate) then
    raise exception 'Período inválido' using errcode = '22023';
  end if;
  if extract(isodow from p_de) > 5 or extract(isodow from p_ate) > 5 then
    raise exception 'O período começa e termina em dia útil' using errcode = '22023';
  end if;
  if p_ate > v_hoje then
    raise exception 'Só dá para lançar até hoje' using errcode = '22023';
  end if;
  if p_quantidade is null or p_quantidade <= 0 or p_pessoas is null or p_pessoas <= 0 then
    raise exception 'Quantidade e pessoas devem ser maiores que zero' using errcode = '22023';
  end if;
  if p_foto_id is not null and not exists (
    select 1 from public.foto where id = p_foto_id and obra_id = v_obra
  ) then
    raise exception 'Foto não é desta obra' using errcode = '23503';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;

  select quant_unidade, prestador into v_unidade, v_prestador
  from public.obra_atividade where id = p_atividade_id for update;
  if v_unidade is null then
    raise exception 'A atividade não tem quantitativo' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.obra_medicao m
    where m.atividade_id = p_atividade_id and m.deleted_at is null and m.id <> p_id
      and m.de <= p_ate and m.ate >= p_de
  ) then
    raise exception 'O período inclui dias já medidos' using errcode = '23P01';
  end if;

  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  select * into v_antes from public.obra_medicao where id = p_id;
  if found then
    if v_antes.atividade_id <> p_atividade_id or v_antes.deleted_at is not null then
      raise exception 'Medição inválida' using errcode = '23503';
    end if;
    update public.obra_medicao
    set tipo = p_tipo, de = p_de, ate = p_ate, quantidade = p_quantidade, pessoas = p_pessoas,
        foto_id = coalesce(p_foto_id, foto_id),
        editado_por = v_pessoa, editado_em = now()
    where id = p_id;
    insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
    values (p_atividade_id, 'medicao_editada', v_pessoa,
            jsonb_build_object('medicao_id', p_id, 'de', v_antes.de, 'ate', v_antes.ate,
                               'quantidade', v_antes.quantidade, 'pessoas', v_antes.pessoas),
            jsonb_build_object('medicao_id', p_id, 'de', p_de, 'ate', p_ate, 'unidade', v_unidade,
                               'quantidade', p_quantidade, 'pessoas', p_pessoas));
  else
    insert into public.obra_medicao (id, obra_id, atividade_id, tipo, de, ate, quantidade, pessoas, prestador, foto_id, criado_por)
    values (p_id, v_obra, p_atividade_id, p_tipo, p_de, p_ate, p_quantidade, p_pessoas, v_prestador, p_foto_id, v_pessoa);
    insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
    values (p_atividade_id, 'medicao', v_pessoa, null,
            jsonb_build_object('medicao_id', p_id, 'de', p_de, 'ate', p_ate, 'unidade', v_unidade,
                               'quantidade', p_quantidade, 'pessoas', p_pessoas));
  end if;
  perform public.contro_recalcular_avanco_medido(p_atividade_id);
end;
$$;
revoke execute on function salvar_medicao(uuid, uuid, text, date, date, numeric, numeric, uuid, uuid) from public, anon;
grant execute on function salvar_medicao(uuid, uuid, text, date, date, numeric, numeric, uuid, uuid) to authenticated;

-- Exclui (lógico) ou restaura uma medição; o Desfazer da exclusão restaura.
create or replace function excluir_medicao(
  p_id uuid,
  p_restaurar boolean default false,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.obra_medicao%rowtype;
  v_pessoa uuid;
  v_unidade text;
begin
  select * into v_m from public.obra_medicao where id = p_id;
  if not found then
    raise exception 'Medição inválida' using errcode = '23503';
  end if;
  perform public.contro_atividade_de_campo(v_m.atividade_id);
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;
  if p_restaurar then
    if v_m.deleted_at is null then return; end if;
    if exists (
      select 1 from public.obra_medicao m
      where m.atividade_id = v_m.atividade_id and m.deleted_at is null and m.id <> p_id
        and m.de <= v_m.ate and m.ate >= v_m.de
    ) then
      raise exception 'O período inclui dias já medidos' using errcode = '23P01';
    end if;
    update public.obra_medicao set deleted_at = null where id = p_id;
  else
    if v_m.deleted_at is not null then return; end if;
    update public.obra_medicao set deleted_at = now() where id = p_id;
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  select quant_unidade into v_unidade from public.obra_atividade where id = v_m.atividade_id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
  values (v_m.atividade_id, case when p_restaurar then 'medicao_restaurada' else 'medicao_excluida' end,
          v_pessoa, null,
          jsonb_build_object('medicao_id', p_id, 'de', v_m.de, 'ate', v_m.ate, 'unidade', v_unidade,
                             'quantidade', v_m.quantidade, 'pessoas', v_m.pessoas));
  perform public.contro_recalcular_avanco_medido(v_m.atividade_id);
end;
$$;
revoke execute on function excluir_medicao(uuid, boolean, uuid) from public, anon;
grant execute on function excluir_medicao(uuid, boolean, uuid) to authenticated;
