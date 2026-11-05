-- Obras gerais · Etapa 2: as ações de campo abrem para quem participa da obra
-- (Coordenador e Membro de obra geral), sem mudar a Contorno.
-- Cada função é cópia literal da versão mais recente; mudam só:
--   1) a entrada: contro_e_membro() vira contro_tem_acesso();
--   2) logo depois de achar a obra do item, contro_ve_obra(obra) (42501);
--   3) concluir_atividade grava 'responsavel_id' (o dono da atividade) no
--      evento 'concluida'.
-- Na Contorno, contro_ve_obra = contro_e_membro(): comportamento igual.
-- Origem das cópias:
--   concluir_atividade     20261104600000_concluir_atividade_fecha_tarefa.sql
--   desfazer_conclusao     20261027120000_mapa_check.sql
--   anexar_foto_conclusao  20261026100000_conclusao_sem_foto.sql
--   definir_avanco         20261028100000_avanco_parcial.sql
--   marcar_subitem         20261024330000_subitem_tarefa_idempotente.sql
--   marcar_providencia     20261024310000_idempotencia.sql
-- Os grants da função (authenticated) permanecem, pois a assinatura não muda.

create or replace function concluir_atividade(
  p_atividade_id uuid,
  p_foto_id uuid,
  p_client_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_obra uuid;
  v_fase uuid;
  v_xp int := 50;
  v_fase_fechada boolean := false;
  v_mapa boolean;
  v_tarefa uuid;
  v_responsavel uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return jsonb_build_object('xp', 0, 'fase_fechada', false, 'repetida', true);
  end if;

  -- Trava a atividade e os subitens dela, em ordem de id (concluir e desfazer
  -- concorrentes rodam em fila, sem deadlock).
  perform 1 from public.obra_atividade
  where id = p_atividade_id or pai_id = p_atividade_id
  order by id
  for update;

  select obra_id, fase_id, mapa_antecedencia_du is not null, responsavel_id
  into v_obra, v_fase, v_mapa, v_responsavel
  from public.obra_atividade where id = p_atividade_id and deleted_at is null and pai_id is null;
  if v_obra is null then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  -- Foto opcional; se vier, tem de ser da mesma obra.
  if p_foto_id is not null and not exists (
    select 1 from public.foto where id = p_foto_id and obra_id = v_obra
  ) then
    raise exception 'Foto não é desta obra' using errcode = '23503';
  end if;
  if exists (select 1 from public.obra_atividade where id = p_atividade_id and concluida_em is not null) then
    raise exception 'Atividade já concluída' using errcode = '23505';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade
  set concluida_em = now(), concluida_por = v_pessoa, foto_conclusao_id = p_foto_id
  where id = p_atividade_id;
  -- Subitens ainda abertos são marcados junto (a atividade foi resolvida).
  update public.obra_atividade
  set concluida_em = now(), concluida_por = v_pessoa
  where pai_id = p_atividade_id and deleted_at is null and concluida_em is null;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (p_atividade_id, 'concluida', v_pessoa,
          jsonb_build_object('foto_id', p_foto_id, 'responsavel_id', v_responsavel));
  -- Tarefas abertas vinculadas à atividade fecham junto (a atividade foi feita).
  for v_tarefa in
    update public.tarefa
    set status = 'feita', feita_em = now(), feita_por = v_pessoa
    where vinculo_tipo = 'atividade' and vinculo_id = p_atividade_id
      and status = 'aberta' and deleted_at is null
    returning id
  loop
    insert into public.tarefa_evento (tarefa_id, tipo, por) values (v_tarefa, 'concluida', v_pessoa);
  end loop;

  if v_mapa then
    -- Mapa de coleta: só controle de pronto ou não; não vale pontos (pedido do usuário).
    v_xp := 0;
  elsif not exists (
    select 1 from public.obra_atividade
    where fase_id = v_fase and pai_id is null and deleted_at is null and concluida_em is null
  ) then
    v_fase_fechada := true;
    v_xp := v_xp + 200;
  end if;
  update public.obra set xp = xp + v_xp where id = v_obra;

  return jsonb_build_object('xp', v_xp, 'fase_fechada', v_fase_fechada);
end;
$$;

create or replace function desfazer_conclusao(
  p_atividade_id uuid,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_obra uuid;
  v_fase uuid;
  v_por uuid;
  v_foto uuid;
  v_xp int := 50;
  v_mapa boolean;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;

  perform 1 from public.obra_atividade
  where id = p_atividade_id or pai_id = p_atividade_id
  order by id
  for update;

  select obra_id, fase_id, concluida_por, foto_conclusao_id, mapa_antecedencia_du is not null
  into v_obra, v_fase, v_por, v_foto, v_mapa
  from public.obra_atividade
  where id = p_atividade_id and deleted_at is null and pai_id is null and concluida_em is not null;
  if v_obra is null then
    raise exception 'Atividade não está concluída' using errcode = '42501';
  end if;
  if not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  -- Fase toda concluída = esta conclusão tinha fechado a fase (+200).
  if v_mapa then
    v_xp := 0;
  elsif not exists (
    select 1 from public.obra_atividade
    where fase_id = v_fase and pai_id is null and deleted_at is null and concluida_em is null
  ) then
    v_xp := v_xp + 200;
  end if;

  update public.obra_atividade
  set concluida_em = null, concluida_por = null, foto_conclusao_id = null
  where id = p_atividade_id;
  update public.obra set xp = greatest(0, xp - v_xp) where id = v_obra;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, antes)
  values (p_atividade_id, 'reaberta', v_pessoa, jsonb_build_object('foto_id', v_foto));
end;
$$;

-- Anexa a foto a uma atividade concluída sem foto.
create or replace function anexar_foto_conclusao(
  p_atividade_id uuid,
  p_foto_id uuid,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_obra uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;

  select obra_id into v_obra
  from public.obra_atividade
  where id = p_atividade_id and deleted_at is null and pai_id is null and concluida_em is not null
  for update;
  if v_obra is null then
    raise exception 'Só atividade concluída recebe foto de conclusão' using errcode = '42501';
  end if;
  if not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if p_foto_id is null or not exists (
    select 1 from public.foto where id = p_foto_id and obra_id = v_obra
  ) then
    raise exception 'Foto não é desta obra' using errcode = '23503';
  end if;
  if exists (
    select 1 from public.obra_atividade where id = p_atividade_id and foto_conclusao_id is not null
  ) then
    raise exception 'A atividade já tem foto de conclusão' using errcode = '23505';
  end if;

  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade set foto_conclusao_id = p_foto_id where id = p_atividade_id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (p_atividade_id, 'foto_anexada', v_pessoa, jsonb_build_object('foto_id', p_foto_id));
end;
$$;

create or replace function definir_avanco(
  p_atividade_id uuid,
  p_pct int,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_antes int;
  v_obra uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if p_pct is null or p_pct < 0 or p_pct > 99 then
    raise exception 'Avanço de 0 a 99%% (100%% é concluir)' using errcode = '22023';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;

  select avanco_pct, obra_id into v_antes, v_obra
  from public.obra_atividade
  where id = p_atividade_id and deleted_at is null and pai_id is null
    and mapa_antecedencia_du is null
  for update;
  if not found then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if exists (select 1 from public.obra_atividade where id = p_atividade_id and concluida_em is not null) then
    raise exception 'Atividade já concluída' using errcode = '23505';
  end if;
  if v_antes = p_pct then
    return;
  end if;

  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade set avanco_pct = p_pct where id = p_atividade_id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
  values (p_atividade_id, 'avanco', v_pessoa,
          jsonb_build_object('pct', v_antes), jsonb_build_object('pct', p_pct));
end;
$$;

create or replace function marcar_subitem(
  p_subitem_id uuid,
  p_feito boolean,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_pai uuid; v_obra uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select a.pai_id, pa.obra_id into v_pai, v_obra
  from public.obra_atividade a
  join public.obra_atividade pa on pa.id = a.pai_id
  where a.id = p_subitem_id and a.pai_id is not null and a.deleted_at is null
    and pa.deleted_at is null and pa.concluida_em is null
  for update of a;
  if v_pai is null then
    raise exception 'Subitem inválido ou atividade já concluída' using errcode = '42501';
  end if;
  if not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade
  set concluida_em = case when p_feito then now() else null end,
      concluida_por = case when p_feito then v_pessoa else null end
  where id = p_subitem_id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (p_subitem_id, 'subitem', v_pessoa, jsonb_build_object('feito', p_feito));
end;
$$;

-- marcar_providencia nunca guardou a obra; aqui ela é lida da providência.
-- Id inexistente segue sendo no-op, como na Contorno de hoje.
create or replace function marcar_providencia(p_id uuid, p_feito boolean, p_client_op_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_obra uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return; -- já aplicada (reenvio da fila)
  end if;
  select obra_id into v_obra from public.obra_providencia where id = p_id;
  if v_obra is not null and not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_providencia
  set status = case when p_feito then 'feito' else 'pendente' end,
      feito_em = case when p_feito then now() else null end,
      feito_por = case when p_feito then v_pessoa else null end
  where id = p_id;
end;
$$;
