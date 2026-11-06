-- Obras gerais · Etapa 2: planejamento da obra geral.
-- Data prevista (com replanejamento rastreado) e responsável na atividade;
-- "planeja" (fase, atividade, subitem, data, responsável, prestador, excluir)
-- = Administrador ou Coordenador participante da obra geral. Na Contorno,
-- planeja = vê a obra (membro da Contorno), exatamente como hoje.

alter table obra_atividade
  add column data_prevista date,
  add column data_prevista_original date,
  add column replanejamentos int not null default 0,
  add column responsavel_id uuid references pessoa (id);

-- Data prevista, replanejamento e responsável só mudam por RPC: a escrita
-- direta do cliente (PostgREST) apagaria o rastro do replanejamento. Sem
-- security definer de propósito: current_user é o do cliente (como em
-- contro_protege_ambiente_obra); RPCs security definer passam.
create or replace function contro_protege_planejamento_atividade()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.data_prevista is not null
         or new.data_prevista_original is not null
         or new.replanejamentos <> 0
         or new.responsavel_id is not null then
        raise exception 'data prevista e responsável só mudam por função' using errcode = '42501';
      end if;
    elsif new.data_prevista is distinct from old.data_prevista
       or new.data_prevista_original is distinct from old.data_prevista_original
       or new.replanejamentos is distinct from old.replanejamentos
       or new.responsavel_id is distinct from old.responsavel_id then
      raise exception 'data prevista e responsável só mudam por função' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger obra_atividade_protege_planejamento before insert or update on obra_atividade
  for each row execute function contro_protege_planejamento_atividade();

-- 1) Quem planeja a obra. Falso para obra apagada ou inexistente.
create or replace function contro_planeja_obra(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.contro_ve_obra(p_obra_id) and (
    exists (select 1 from public.obra o where o.id = p_obra_id and o.ambiente = 'contorno')
    or public.contro_coordena_obra(p_obra_id)
  );
$$;
revoke execute on function contro_planeja_obra(uuid) from public, anon;
grant execute on function contro_planeja_obra(uuid) to authenticated;

-- 2) RLS: escrita direta no planejamento só para quem planeja. Leitura (_sel)
-- e foto ficam como estão.
do $$
declare t text;
begin
  foreach t in array array['obra_fase','obra_atividade','obra_dependencia','obra_providencia'] loop
    execute format('drop policy %I on %I', t || '_ins', t);
    execute format('drop policy %I on %I', t || '_upd', t);
    execute format('create policy %I on %I for insert to authenticated with check (contro_planeja_obra(obra_id))', t || '_ins', t);
    execute format('create policy %I on %I for update to authenticated using (contro_planeja_obra(obra_id)) with check (contro_planeja_obra(obra_id))', t || '_upd', t);
  end loop;
end $$;

drop policy obra_dependencia_del on obra_dependencia;
create policy obra_dependencia_del on obra_dependencia for delete to authenticated
  using (contro_planeja_obra(obra_id));

-- 3) Entrada comum das RPCs de obra geral (internas: só as RPCs abaixo usam).
-- Obra inexistente → 23503; obra Contorno → 23505 (segue pelas RPCs dela);
-- sem papel de planejar → 42501.
create or replace function contro_exige_planejar_geral(p_obra_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_ambiente text;
begin
  select ambiente into v_ambiente from public.obra where id = p_obra_id and deleted_at is null;
  if v_ambiente is null then
    raise exception 'Obra inválida' using errcode = '23503';
  end if;
  if v_ambiente <> 'geral' then
    raise exception 'Obra da Contorno: use as funções da Contorno' using errcode = '23505';
  end if;
  if not public.contro_planeja_obra(p_obra_id) then
    raise exception 'Só o coordenador planeja a obra' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function contro_exige_planejar_geral(uuid) from public, anon, authenticated;

-- Responsável: pessoa ativa que participa da obra, ou Administrador ativo.
create or replace function contro_valida_responsavel_geral(p_obra_id uuid, p_responsavel_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_responsavel_id is null then
    return;
  end if;
  if not exists (
    select 1 from public.pessoa p
    where p.id = p_responsavel_id and p.deleted_at is null and p.ativo
      and (p.administrador or exists (
        select 1 from public.obra_participante op
        where op.obra_id = p_obra_id and op.pessoa_id = p.id
      ))
  ) then
    raise exception 'Responsável precisa participar da obra' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function contro_valida_responsavel_geral(uuid, uuid) from public, anon, authenticated;

-- Regra da data prevista (interna; já validado o acesso e o item).
-- Mesma data: nada (devolve null). Item aberto que já tinha data e recebe
-- outra: replaneja (guarda a original só na primeira vez). Item aberto com data
-- não volta a "sem data" (22023: o Desfazer usa desfazer_data_prevista). Sem
-- data antes, ou item concluído: só troca a data e grava data_definida, sem
-- contar replanejamento. O evento guarda em `antes` a data, a original e o
-- contador, para o Desfazer voltar exatamente; devolve o id do evento. O `em`
-- usa clock_timestamp() para ordenar eventos da mesma transação.
create or replace function contro_aplica_data_prevista(p_atividade_id uuid, p_data date, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atv public.obra_atividade%rowtype;
  v_pessoa uuid;
  v_evento uuid;
  v_antes jsonb;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  select * into v_atv from public.obra_atividade where id = p_atividade_id for update;
  if p_data is not distinct from v_atv.data_prevista then
    return null;
  end if;
  if p_data is null and v_atv.concluida_em is null then
    raise exception 'Não dá para tirar a data; use Desfazer' using errcode = '22023';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  v_antes := jsonb_build_object(
    'data', v_atv.data_prevista,
    'data_prevista_original', v_atv.data_prevista_original,
    'replanejamentos', v_atv.replanejamentos);
  if v_atv.concluida_em is null and v_atv.data_prevista is not null then
    update public.obra_atividade set
      data_prevista = p_data,
      data_prevista_original = coalesce(data_prevista_original, v_atv.data_prevista),
      replanejamentos = replanejamentos + 1
    where id = p_atividade_id;
    insert into public.obra_atividade_evento (atividade_id, tipo, por, em, antes, depois)
    values (p_atividade_id, 'replanejada', v_pessoa, clock_timestamp(), v_antes,
      jsonb_strip_nulls(jsonb_build_object('data', p_data, 'motivo', v_motivo)))
    returning id into v_evento;
  else
    update public.obra_atividade set data_prevista = p_data where id = p_atividade_id;
    insert into public.obra_atividade_evento (atividade_id, tipo, por, em, antes, depois)
    values (p_atividade_id, 'data_definida', v_pessoa, clock_timestamp(), v_antes,
      jsonb_build_object('data', p_data))
    returning id into v_evento;
  end if;
  return v_evento;
end;
$$;
revoke execute on function contro_aplica_data_prevista(uuid, date, text) from public, anon, authenticated;

-- 4) RPCs de obra geral.
create or replace function adicionar_fase_geral(p_obra_id uuid, p_titulo text, p_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_titulo text := btrim(coalesce(p_titulo, ''));
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  perform public.contro_exige_planejar_geral(p_obra_id);
  -- Repetição da mesma op (offline, duplo toque): devolve a que já existe.
  if exists (select 1 from public.obra_fase where id = v_id and obra_id = p_obra_id) then
    return v_id;
  end if;
  if v_titulo = '' then
    raise exception 'Informe o nome da fase' using errcode = '22023';
  end if;
  insert into public.obra_fase (id, obra_id, ordem, titulo, preliminar)
  select v_id, p_obra_id, coalesce(max(ordem), 0) + 1, v_titulo, false
  from public.obra_fase where obra_id = p_obra_id;
  return v_id;
end;
$$;

create or replace function adicionar_atividade_geral(
  p_obra_id uuid,
  p_fase_id uuid,
  p_nome text,
  p_responsavel_id uuid,
  p_data_prevista date,
  p_subitens jsonb default '[]',
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_nome text := btrim(coalesce(p_nome, ''));
  v_subitens jsonb := coalesce(p_subitens, '[]'::jsonb);
  v_pessoa uuid;
  v_ordem int;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  perform public.contro_exige_planejar_geral(p_obra_id);
  -- Repetição da mesma op (offline, duplo toque): devolve a que já existe.
  if exists (select 1 from public.obra_atividade where id = v_id and obra_id = p_obra_id) then
    return v_id;
  end if;
  if not exists (select 1 from public.obra_fase where id = p_fase_id and obra_id = p_obra_id) then
    raise exception 'Fase não é desta obra' using errcode = '23503';
  end if;
  if v_nome = '' then
    raise exception 'Informe o nome da atividade' using errcode = '22023';
  end if;
  if jsonb_typeof(v_subitens) <> 'array' then
    raise exception 'Subitens inválidos' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_subitens) s
    where jsonb_typeof(s) <> 'object' or btrim(coalesce(s ->> 'nome', '')) = ''
  ) then
    raise exception 'Informe o nome do subitem' using errcode = '22023';
  end if;
  perform public.contro_valida_responsavel_geral(p_obra_id, p_responsavel_id);

  select coalesce(max(ordem), 0) + 1 into v_ordem
  from public.obra_atividade where obra_id = p_obra_id and fase_id = p_fase_id and pai_id is null;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;

  insert into public.obra_atividade (id, obra_id, fase_id, ordem, nome, data_prevista, responsavel_id)
  values (v_id, p_obra_id, p_fase_id, v_ordem, v_nome, p_data_prevista, p_responsavel_id);
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (v_id, 'criada', v_pessoa,
    jsonb_build_object('nome', v_nome, 'data_prevista', p_data_prevista, 'responsavel_id', p_responsavel_id));
  -- Subitens: mesmas linhas e mesmo evento 'criada' de adicionar_subitem_geral.
  with novos as (
    insert into public.obra_atividade (id, obra_id, fase_id, pai_id, ordem, nome, data_prevista)
    select coalesce((s.v ->> 'id')::uuid, gen_random_uuid()), p_obra_id, p_fase_id, v_id, s.n::int,
           btrim(s.v ->> 'nome'), (s.v ->> 'data_prevista')::date
    from jsonb_array_elements(v_subitens) with ordinality as s(v, n)
    returning id, nome, data_prevista
  )
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  select id, 'criada', v_pessoa, jsonb_build_object('nome', nome, 'data_prevista', data_prevista)
  from novos;
  return v_id;
end;
$$;

create or replace function adicionar_subitem_geral(
  p_atividade_id uuid,
  p_nome text,
  p_data_prevista date,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_nome text := btrim(coalesce(p_nome, ''));
  v_pai public.obra_atividade%rowtype;
  v_pessoa uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select * into v_pai from public.obra_atividade where id = p_atividade_id;
  if not found then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  perform public.contro_exige_planejar_geral(v_pai.obra_id);
  -- Repetição da mesma op (offline, duplo toque): devolve o que já existe.
  if exists (select 1 from public.obra_atividade where id = v_id and pai_id = p_atividade_id) then
    return v_id;
  end if;
  if v_pai.pai_id is not null or v_pai.deleted_at is not null or v_pai.concluida_em is not null then
    raise exception 'Subitem só em atividade aberta' using errcode = '23503';
  end if;
  if v_nome = '' then
    raise exception 'Informe o nome do subitem' using errcode = '22023';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  insert into public.obra_atividade (id, obra_id, fase_id, pai_id, ordem, nome, data_prevista)
  select v_id, v_pai.obra_id, v_pai.fase_id, p_atividade_id, coalesce(max(ordem), 0) + 1, v_nome, p_data_prevista
  from public.obra_atividade where pai_id = p_atividade_id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (v_id, 'criada', v_pessoa, jsonb_build_object('nome', v_nome, 'data_prevista', p_data_prevista));
  return v_id;
end;
$$;

-- Devolve o id do evento da data (null quando a data não mudou), para o Desfazer.
create or replace function editar_subitem_geral(p_subitem_id uuid, p_nome text, p_data_prevista date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_sub public.obra_atividade%rowtype;
  v_pessoa uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select * into v_sub from public.obra_atividade
  where id = p_subitem_id and pai_id is not null and deleted_at is null;
  if not found then
    raise exception 'Subitem inválido' using errcode = '23503';
  end if;
  perform public.contro_exige_planejar_geral(v_sub.obra_id);
  if not exists (
    select 1 from public.obra_atividade
    where id = v_sub.pai_id and pai_id is null and deleted_at is null and concluida_em is null
  ) then
    raise exception 'Subitem só em atividade aberta' using errcode = '23503';
  end if;
  if v_nome = '' then
    raise exception 'Informe o nome do subitem' using errcode = '22023';
  end if;
  if v_nome is distinct from v_sub.nome then
    select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
    update public.obra_atividade set nome = v_nome where id = p_subitem_id;
    insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
    values (p_subitem_id, 'editada', v_pessoa,
      jsonb_build_object('nome', v_sub.nome), jsonb_build_object('nome', v_nome));
  end if;
  return public.contro_aplica_data_prevista(p_subitem_id, p_data_prevista, null);
end;
$$;

-- Devolve o id do evento da data (null quando nada mudou), para o Desfazer.
create or replace function definir_data_prevista(p_atividade_id uuid, p_data date, p_motivo text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_obra uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select obra_id into v_obra from public.obra_atividade where id = p_atividade_id and deleted_at is null;
  if v_obra is null then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  perform public.contro_exige_planejar_geral(v_obra);
  return public.contro_aplica_data_prevista(p_atividade_id, p_data, p_motivo);
end;
$$;

-- Desfazer da data (toast de 5 s): volta a data, a original e o contador
-- exatamente como estavam, sem contar replanejamento. Só quem planeja, só o
-- próprio evento, até 10 min depois e só o último evento de data do item.
create or replace function desfazer_data_prevista(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ev public.obra_atividade_evento%rowtype;
  v_atv public.obra_atividade%rowtype;
  v_pessoa uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select * into v_ev from public.obra_atividade_evento where id = p_evento_id;
  if not found then
    raise exception 'Não dá mais para desfazer' using errcode = '22023';
  end if;
  select * into v_atv from public.obra_atividade where id = v_ev.atividade_id for update;
  perform public.contro_exige_planejar_geral(v_atv.obra_id);
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  if v_ev.tipo not in ('replanejada', 'data_definida')
     or v_ev.por is distinct from v_pessoa
     or v_ev.em < now() - interval '10 minutes'
     or not (coalesce(v_ev.antes, '{}'::jsonb) ? 'replanejamentos')
     or exists (
       select 1 from public.obra_atividade_evento e
       where e.atividade_id = v_ev.atividade_id and e.id <> v_ev.id
         and e.tipo in ('replanejada', 'data_definida', 'data_desfeita')
         and e.em >= v_ev.em
     ) then
    raise exception 'Não dá mais para desfazer' using errcode = '22023';
  end if;
  update public.obra_atividade set
    data_prevista = (v_ev.antes ->> 'data')::date,
    data_prevista_original = (v_ev.antes ->> 'data_prevista_original')::date,
    replanejamentos = (v_ev.antes ->> 'replanejamentos')::int
  where id = v_atv.id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, em, antes, depois)
  values (v_atv.id, 'data_desfeita', v_pessoa, clock_timestamp(),
    jsonb_build_object(
      'data', v_atv.data_prevista,
      'data_prevista_original', v_atv.data_prevista_original,
      'replanejamentos', v_atv.replanejamentos),
    v_ev.antes || jsonb_build_object('evento_id', v_ev.id));
end;
$$;

create or replace function definir_responsavel_atividade(p_atividade_id uuid, p_responsavel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid;
  v_antigo uuid;
  v_pessoa uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select obra_id, responsavel_id into v_obra, v_antigo from public.obra_atividade
  where id = p_atividade_id and pai_id is null and deleted_at is null
  for update;
  if v_obra is null then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  perform public.contro_exige_planejar_geral(v_obra);
  perform public.contro_valida_responsavel_geral(v_obra, p_responsavel_id);
  if p_responsavel_id is not distinct from v_antigo then
    return;
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade set responsavel_id = p_responsavel_id where id = p_atividade_id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
  values (p_atividade_id, 'responsavel', v_pessoa,
    jsonb_build_object('responsavel_id', v_antigo), jsonb_build_object('responsavel_id', p_responsavel_id));
end;
$$;

-- Excluir e restaurar subitem da obra geral (exclusão lógica com evento, para
-- o Desfazer). A Contorno segue com as funções dela (23505).
create or replace function excluir_subitem_geral(p_subitem_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.obra_atividade%rowtype;
  v_pessoa uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select * into v_sub from public.obra_atividade where id = p_subitem_id and pai_id is not null;
  if not found then
    raise exception 'Subitem inválido' using errcode = '23503';
  end if;
  perform public.contro_exige_planejar_geral(v_sub.obra_id);
  -- Repetição da mesma op (offline, duplo toque): já excluído.
  if v_sub.deleted_at is not null then
    return;
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade set deleted_at = now() where id = p_subitem_id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por)
  values (p_subitem_id, 'excluida', v_pessoa);
end;
$$;

create or replace function restaurar_subitem_geral(p_subitem_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.obra_atividade%rowtype;
  v_pessoa uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select * into v_sub from public.obra_atividade where id = p_subitem_id and pai_id is not null;
  if not found then
    raise exception 'Subitem inválido' using errcode = '23503';
  end if;
  perform public.contro_exige_planejar_geral(v_sub.obra_id);
  -- Repetição da mesma op (offline, duplo toque): já restaurado.
  if v_sub.deleted_at is null then
    return;
  end if;
  if not exists (select 1 from public.obra_atividade where id = v_sub.pai_id and deleted_at is null) then
    raise exception 'A atividade do subitem foi excluída' using errcode = '23503';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade set deleted_at = null where id = p_subitem_id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por)
  values (p_subitem_id, 'restaurada', v_pessoa);
end;
$$;

revoke execute on function excluir_subitem_geral(uuid) from public, anon;
revoke execute on function restaurar_subitem_geral(uuid) from public, anon;
grant execute on function excluir_subitem_geral(uuid) to authenticated;
grant execute on function restaurar_subitem_geral(uuid) to authenticated;

revoke execute on function adicionar_fase_geral(uuid, text, uuid) from public, anon;
revoke execute on function adicionar_atividade_geral(uuid, uuid, text, uuid, date, jsonb, uuid) from public, anon;
revoke execute on function adicionar_subitem_geral(uuid, text, date, uuid) from public, anon;
revoke execute on function editar_subitem_geral(uuid, text, date) from public, anon;
revoke execute on function definir_data_prevista(uuid, date, text) from public, anon;
revoke execute on function desfazer_data_prevista(uuid) from public, anon;
revoke execute on function definir_responsavel_atividade(uuid, uuid) from public, anon;
grant execute on function adicionar_fase_geral(uuid, text, uuid) to authenticated;
grant execute on function adicionar_atividade_geral(uuid, uuid, text, uuid, date, jsonb, uuid) to authenticated;
grant execute on function adicionar_subitem_geral(uuid, text, date, uuid) to authenticated;
grant execute on function editar_subitem_geral(uuid, text, date) to authenticated;
grant execute on function definir_data_prevista(uuid, date, text) to authenticated;
grant execute on function desfazer_data_prevista(uuid) to authenticated;
grant execute on function definir_responsavel_atividade(uuid, uuid) to authenticated;

-- 5) Excluir e restaurar (cópia de 20261027140000): muda só a entrada —
-- contro_tem_acesso() e quem planeja a obra do item.
create or replace function excluir_atividade_obra(p_atividade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_subs uuid[];
  v_obra uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select obra_id into v_obra from public.obra_atividade
  where id = p_atividade_id and pai_id is null and deleted_at is null;
  if v_obra is null then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  if not public.contro_planeja_obra(v_obra) then
    raise exception 'Sem permissão para planejar esta obra' using errcode = '42501';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  -- Subitens abertos saem junto; o evento guarda quais, para o Desfazer trazer de volta.
  select coalesce(array_agg(id), '{}') into v_subs
  from public.obra_atividade where pai_id = p_atividade_id and deleted_at is null;
  update public.obra_atividade set deleted_at = now()
  where id = p_atividade_id or id = any(v_subs);
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (p_atividade_id, 'excluida', v_pessoa, jsonb_build_object('subitens', to_jsonb(v_subs)));
end;
$$;

create or replace function restaurar_atividade_obra(p_atividade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_subs jsonb;
  v_obra uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select obra_id into v_obra from public.obra_atividade
  where id = p_atividade_id and pai_id is null and deleted_at is not null;
  if v_obra is null then
    raise exception 'Atividade não está excluída' using errcode = '23503';
  end if;
  if not public.contro_planeja_obra(v_obra) then
    raise exception 'Sem permissão para planejar esta obra' using errcode = '42501';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  select depois -> 'subitens' into v_subs from public.obra_atividade_evento
  where atividade_id = p_atividade_id and tipo = 'excluida' order by em desc limit 1;
  update public.obra_atividade set deleted_at = null
  where id = p_atividade_id
     or id in (select (jsonb_array_elements_text(coalesce(v_subs, '[]'::jsonb)))::uuid);
  insert into public.obra_atividade_evento (atividade_id, tipo, por)
  values (p_atividade_id, 'restaurada', v_pessoa);
end;
$$;

-- 6) Prestador em obra geral: só apara e junta espaços; não consulta nem
-- alimenta sugestao (as sugestões por ambiente ficam para a etapa 5).
create or replace function public.contro_normalizar_prestador_atividade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chave text := public.contro_chave_prestador(new.prestador);
  v_nome text;
begin
  if exists (select 1 from public.obra where id = new.obra_id and ambiente = 'geral') then
    new.prestador := nullif(regexp_replace(trim(new.prestador), '\s+', ' ', 'g'), '');
    return new;
  end if;
  if nullif(v_chave, '') is null then
    new.prestador := null;
    return new;
  end if;
  select texto into v_nome from public.sugestao
  where tipo = 'prestador' and public.contro_chave_prestador(texto) = v_chave
  order by created_at, texto
  limit 1;
  new.prestador := coalesce(v_nome, regexp_replace(trim(new.prestador), '\s+', ' ', 'g'));
  return new;
end;
$$;

create or replace function contro_sugestao_prestador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_nome text := nullif(trim(coalesce(new.prestador, '')), '');
begin
  if exists (select 1 from public.obra where id = new.obra_id and ambiente = 'geral') then
    return new;
  end if;
  if v_nome is not null and v_nome is distinct from nullif(trim(coalesce(old.prestador, '')), '') then
    insert into public.sugestao (tipo, texto) values ('prestador', v_nome)
    on conflict (tipo, texto) do update set usos = public.sugestao.usos + 1, ultimo_uso = now();
  end if;
  return new;
end;
$$;
