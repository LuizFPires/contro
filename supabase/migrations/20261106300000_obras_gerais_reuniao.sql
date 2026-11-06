-- Obras gerais · Etapa 4: reunião por obra geral (decisão 1).
-- Uma reunião por obra geral e data (reuniao.obra_id). A reunião única da
-- Contorno (obra_id nulo) não muda: abrir_reuniao, reabrir_reuniao e
-- fechar_reuniao são cópias literais da versão mais recente, só presas a
-- obra_id nulo. Fechar e reabrir a ata da obra geral = quem planeja a obra
-- (Coordenador, Administrador); responder itens e observações = qualquer
-- participante.
-- Origem das cópias:
--   abrir_reuniao, reabrir_reuniao  20261105220000_obras_gerais_rls.sql §5
--   fechar_reuniao                  20261024300000_reuniao.sql
--   salvar_observacao_reuniao       20261024300000_reuniao.sql
--   responder_reuniao               20261029100000_ata_colaborativa.sql
-- Os grants das funções recriadas permanecem (a assinatura não muda).

-- 1) Tabela: a reunião pode ser de uma obra geral.
alter table reuniao add column obra_id uuid references obra (id) on delete cascade;
alter table reuniao drop constraint reuniao_data_key;
create unique index reuniao_contorno_data on reuniao (data) where obra_id is null;
create unique index reuniao_obra_data on reuniao (obra_id, data) where obra_id is not null;

drop policy reuniao_sel on reuniao;
create policy reuniao_sel on reuniao for select to authenticated
  using (
    (obra_id is null and contro_e_membro())
    or (obra_id is not null and contro_ve_obra(obra_id))
  );

-- 2) Contorno: as mesmas funções, só na reunião sem obra.
create or replace function abrir_reuniao(p_data date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid; v_status text;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  -- Idempotente e à prova de corrida (dois membros abrindo a tela ao mesmo tempo).
  insert into public.reuniao (data, hora)
  values (p_data, coalesce((select reuniao_hora from public.config_avisos where id), '16:00'))
  on conflict (data) where obra_id is null do nothing;
  select id, status into v_id, v_status from public.reuniao
  where data = p_data and obra_id is null for update;
  -- Só completa a pauta enquanto a reunião não está fechada (não muta a ata histórica).
  if v_status <> 'fechada' then
    insert into public.reuniao_obra (reuniao_id, obra_id)
    select v_id, o.id from public.obra o
    where o.status = 'ativa' and o.deleted_at is null and o.ambiente = 'contorno'
    on conflict (reuniao_id, obra_id) do nothing;
  end if;
  return v_id;
end;
$$;

create or replace function reabrir_reuniao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor reabre a pauta' using errcode = '42501';
  end if;
  -- Só a reunião da Contorno (a da obra geral reabre por reabrir_reuniao_geral).
  update public.reuniao
  set status = 'pauta', fechada_em = null, fechada_por = null
  where id = p_id and status = 'fechada' and obra_id is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Reunião não está fechada' using errcode = '42501';
  end if;
  insert into public.reuniao_obra (reuniao_id, obra_id)
  select p_id, o.id from public.obra o
  where o.status = 'ativa' and o.deleted_at is null and o.ambiente = 'contorno'
  on conflict (reuniao_id, obra_id) do nothing;
end;
$$;

-- Fecha a reunião (só gestor) e materializa o snapshot por obra (vindo do cliente).
create or replace function fechar_reuniao(p_id uuid, p_snapshots jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor fecha a reunião' using errcode = '42501';
  end if;
  -- Só a reunião da Contorno (a da obra geral fecha por fechar_reuniao_geral).
  update public.reuniao
  set status = 'fechada', fechada_em = now(), fechada_por = public.contro_pessoa_atual()
  where id = p_id and status <> 'fechada' and obra_id is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Reunião já fechada ou inválida' using errcode = '42501';
  end if;
  if p_snapshots is not null then
    update public.reuniao_obra ro
    set snapshot = s.snapshot
    from (
      select (x->>'obra_id')::uuid as obra_id, x->'snapshot' as snapshot
      from jsonb_array_elements(p_snapshots) x
    ) s
    where ro.reuniao_id = p_id and ro.obra_id = s.obra_id;
  end if;
end;
$$;

-- 3) Observação e resposta: entrada contro_tem_acesso() e, depois de achar a
-- obra na pauta, contro_ve_obra(obra) (42501). Na Contorno, contro_ve_obra =
-- contro_e_membro(): comportamento igual.
create or replace function salvar_observacao_reuniao(
  p_reuniao_id uuid,
  p_obra_id uuid,
  p_texto text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text; v_n int;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  -- Trava a linha da reunião (fechar_reuniao também a trava no UPDATE), evitando
  -- a corrida entre checar o status e gravar.
  select status into v_status from public.reuniao where id = p_reuniao_id for update;
  if v_status is null then
    raise exception 'Reunião inválida' using errcode = '23503';
  end if;
  if v_status = 'fechada' then
    raise exception 'Reunião fechada' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.reuniao_obra where reuniao_id = p_reuniao_id and obra_id = p_obra_id
  ) then
    raise exception 'Obra não é desta reunião' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  update public.reuniao_obra set observacoes = p_texto
  where reuniao_id = p_reuniao_id and obra_id = p_obra_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Obra não é desta reunião' using errcode = '23503';
  end if;
end;
$$;

-- Grava (ou apaga, com p_resposta nula) a resposta de um item da pauta.
create or replace function responder_reuniao(
  p_reuniao_id uuid,
  p_obra_id uuid,
  p_secao text,
  p_item_id uuid,
  p_resposta text,
  p_tarefa_id uuid default null,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  -- Trava a reunião (como salvar_observacao_reuniao) contra fechar ao mesmo tempo.
  select status into v_status from public.reuniao where id = p_reuniao_id for update;
  if v_status is null then
    raise exception 'Reunião inválida' using errcode = '23503';
  end if;
  if v_status = 'fechada' then
    raise exception 'Reunião fechada' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.reuniao_obra where reuniao_id = p_reuniao_id and obra_id = p_obra_id
  ) then
    raise exception 'Obra não está na pauta' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;

  if p_tarefa_id is not null and not exists (
    select 1 from public.tarefa where id = p_tarefa_id and obra_id = p_obra_id
  ) then
    raise exception 'Ação não é desta obra' using errcode = '23503';
  end if;

  if p_resposta is null then
    delete from public.reuniao_resposta
    where reuniao_id = p_reuniao_id and secao = p_secao and item_id = p_item_id;
    return;
  end if;

  insert into public.reuniao_resposta (reuniao_id, obra_id, secao, item_id, resposta, tarefa_id, respondido_por)
  values (p_reuniao_id, p_obra_id, p_secao, p_item_id, p_resposta, p_tarefa_id, public.contro_pessoa_atual())
  on conflict (reuniao_id, secao, item_id) do update
    set resposta = excluded.resposta,
        tarefa_id = coalesce(excluded.tarefa_id, public.reuniao_resposta.tarefa_id),
        respondido_por = excluded.respondido_por,
        respondido_em = now();
end;
$$;

-- 4) Obra geral: abrir (participante), fechar e reabrir (quem planeja).

-- Abre (ou devolve) a reunião da obra geral na data, com a linha única da obra
-- em reuniao_obra. Idempotente; reunião fechada não muda.
create or replace function abrir_reuniao_geral(p_obra_id uuid, p_data date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_ambiente text; v_id uuid; v_status text;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select ambiente into v_ambiente from public.obra where id = p_obra_id and deleted_at is null;
  if v_ambiente is null then
    raise exception 'Obra inválida' using errcode = '23503';
  end if;
  if v_ambiente <> 'geral' then
    raise exception 'Obra da Contorno: use as funções da Contorno' using errcode = '23505';
  end if;
  if not public.contro_ve_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  -- Hora: por enquanto a global (config_avisos). A Task 4 cria
  -- config_avisos_obra e recria esta função lendo a da obra → global → 16:00.
  insert into public.reuniao (data, hora, obra_id)
  values (p_data, coalesce((select reuniao_hora from public.config_avisos where id), '16:00'), p_obra_id)
  on conflict (obra_id, data) where obra_id is not null do nothing;
  select id, status into v_id, v_status from public.reuniao
  where obra_id = p_obra_id and data = p_data for update;
  if v_status <> 'fechada' then
    insert into public.reuniao_obra (reuniao_id, obra_id)
    values (v_id, p_obra_id)
    on conflict (reuniao_id, obra_id) do nothing;
  end if;
  return v_id;
end;
$$;

-- Fecha a ata da obra geral e grava o snapshot da obra (vindo do cliente).
create or replace function fechar_reuniao_geral(p_id uuid, p_snapshot jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_obra uuid; v_n int;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select obra_id into v_obra from public.reuniao where id = p_id;
  if not found then
    raise exception 'Reunião inválida' using errcode = '23503';
  end if;
  if v_obra is null then
    raise exception 'Reunião da Contorno: use fechar_reuniao' using errcode = '23505';
  end if;
  perform public.contro_exige_planejar_geral(v_obra);
  update public.reuniao
  set status = 'fechada', fechada_em = now(), fechada_por = public.contro_pessoa_atual()
  where id = p_id and status <> 'fechada';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Reunião já fechada' using errcode = '42501';
  end if;
  if p_snapshot is not null then
    update public.reuniao_obra set snapshot = p_snapshot
    where reuniao_id = p_id and obra_id = v_obra;
  end if;
end;
$$;

-- Reabre a ata da obra geral (volta a pauta) e garante a linha da obra.
create or replace function reabrir_reuniao_geral(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_obra uuid; v_n int;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select obra_id into v_obra from public.reuniao where id = p_id;
  if not found then
    raise exception 'Reunião inválida' using errcode = '23503';
  end if;
  if v_obra is null then
    raise exception 'Reunião da Contorno: use reabrir_reuniao' using errcode = '23505';
  end if;
  perform public.contro_exige_planejar_geral(v_obra);
  update public.reuniao
  set status = 'pauta', fechada_em = null, fechada_por = null
  where id = p_id and status = 'fechada';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Reunião não está fechada' using errcode = '42501';
  end if;
  insert into public.reuniao_obra (reuniao_id, obra_id)
  values (p_id, v_obra)
  on conflict (reuniao_id, obra_id) do nothing;
end;
$$;

revoke execute on function abrir_reuniao_geral(uuid, date) from public, anon;
grant execute on function abrir_reuniao_geral(uuid, date) to authenticated;
revoke execute on function fechar_reuniao_geral(uuid, jsonb) from public, anon;
grant execute on function fechar_reuniao_geral(uuid, jsonb) to authenticated;
revoke execute on function reabrir_reuniao_geral(uuid) from public, anon;
grant execute on function reabrir_reuniao_geral(uuid) to authenticated;
