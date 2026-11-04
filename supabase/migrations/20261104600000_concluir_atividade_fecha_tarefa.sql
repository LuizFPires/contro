-- Atividades como ações (04/11/2026): concluir a atividade (pela obra, pela
-- ficha ou pela câmera da tarefa) fecha as tarefas abertas vinculadas a ela,
-- com o evento 'concluida' de cada uma (mesmo formato de concluir_tarefa).
-- O resto de concluir_atividade segue igual a 20261027120000_mapa_check.sql.
-- desfazer_conclusao NÃO reabre as tarefas: o Desfazer da tela reabre a
-- atividade e a tarefa, cada uma pela sua op.
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
begin
  if not public.contro_e_membro() then
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

  select obra_id, fase_id, mapa_antecedencia_du is not null into v_obra, v_fase, v_mapa
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
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade
  set concluida_em = now(), concluida_por = v_pessoa, foto_conclusao_id = p_foto_id
  where id = p_atividade_id;
  -- Subitens ainda abertos são marcados junto (a atividade foi resolvida).
  update public.obra_atividade
  set concluida_em = now(), concluida_por = v_pessoa
  where pai_id = p_atividade_id and deleted_at is null and concluida_em is null;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (p_atividade_id, 'concluida', v_pessoa, jsonb_build_object('foto_id', p_foto_id));
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
