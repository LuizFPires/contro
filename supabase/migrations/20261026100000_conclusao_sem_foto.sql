-- Conclusão de atividade COM ou SEM foto (decisão do usuário, 26/10/2026).
-- A foto passa a ser opcional: sem foto, a atividade fica "Concluída · sem foto"
-- e a foto pode ser anexada depois (anexar_foto_conclusao). O "Desfazer" do
-- toast reabre a atividade (desfazer_conclusao). Todas idempotentes por
-- client_op_id (fila offline) e SECURITY DEFINER (o trigger
-- contro_protege_conclusao barra mudança direta pelo cliente).

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
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return jsonb_build_object('xp', 0, 'fase_fechada', false, 'repetida', true);
  end if;

  select obra_id, fase_id into v_obra, v_fase
  from public.obra_atividade where id = p_atividade_id and deleted_at is null and pai_id is null;
  if v_obra is null then
    raise exception 'Atividade inválida' using errcode = '23503';
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
  if exists (
    select 1 from public.obra_dependencia d
    join public.obra_atividade p on p.id = d.predecessora_id
    where d.atividade_id = p_atividade_id and p.concluida_em is null
  ) then
    raise exception 'Não liberada: predecessoras pendentes' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.obra_providencia
    where atividade_id = p_atividade_id and status = 'pendente'
  ) then
    raise exception 'Não liberada: providências pendentes' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.obra_atividade s where s.pai_id = p_atividade_id and s.concluida_em is null
  ) then
    raise exception 'Faltam subitens marcados' using errcode = '42501';
  end if;

  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade
  set concluida_em = now(), concluida_por = v_pessoa, foto_conclusao_id = p_foto_id
  where id = p_atividade_id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (p_atividade_id, 'concluida', v_pessoa, jsonb_build_object('foto_id', p_foto_id));

  if not exists (
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
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;

  select obra_id into v_obra
  from public.obra_atividade
  where id = p_atividade_id and deleted_at is null and pai_id is null and concluida_em is not null;
  if v_obra is null then
    raise exception 'Só atividade concluída recebe foto de conclusão' using errcode = '42501';
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

-- "Desfazer" da conclusão: só quem concluiu, e só enquanto nenhuma atividade
-- que depende desta foi concluída. Devolve o XP (e o bônus da fase, se fechou).
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
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;

  select obra_id, fase_id, concluida_por, foto_conclusao_id
  into v_obra, v_fase, v_por, v_foto
  from public.obra_atividade
  where id = p_atividade_id and deleted_at is null and pai_id is null and concluida_em is not null;
  if v_obra is null then
    raise exception 'Atividade não está concluída' using errcode = '42501';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  if v_por is distinct from v_pessoa then
    raise exception 'Só quem concluiu pode desfazer' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.obra_dependencia d
    join public.obra_atividade s on s.id = d.atividade_id
    where d.predecessora_id = p_atividade_id and s.concluida_em is not null
  ) then
    raise exception 'Uma atividade que depende desta já foi concluída' using errcode = '42501';
  end if;

  -- Fase toda concluída = esta conclusão tinha fechado a fase (+200).
  if not exists (
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

revoke all on function anexar_foto_conclusao(uuid, uuid, uuid) from public, anon;
revoke all on function desfazer_conclusao(uuid, uuid) from public, anon;
grant execute on function anexar_foto_conclusao(uuid, uuid, uuid) to authenticated;
grant execute on function desfazer_conclusao(uuid, uuid) to authenticated;
