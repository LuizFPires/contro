-- Obras gerais · Etapa 4: quem sai de uma obra geral também deixa as tarefas
-- e as pendências abertas dela (antes, só as atividades). Sem isso a pessoa
-- seguia como responsável e recebia acoes_geral de uma obra que não vê mais.
-- Corpo copiado de 20261106200000_obras_gerais_avisos.sql §4, com:
--   * tarefa aberta e não excluída da obra com a pessoa → responsavel_id nulo,
--     com tarefa_evento 'editada' (antes/depois responsavel_id, motivo);
--   * pendência aberta e não excluída da obra com a pessoa → responsavel_id
--     nulo, com pendencia_evento 'responsavel_alterado' (o de atribuir_pendencia).
-- O aviso aos Coordenadores e Administradores segue contando só atividades.
create or replace function contro_obra_participante_sai()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_por uuid;
  v_n int;
  v_obra text;
  v_nome text;
begin
  if not exists (select 1 from public.obra where id = old.obra_id and deleted_at is null) then
    return old;
  end if;
  select id into v_por from public.pessoa where user_id = auth.uid() and deleted_at is null;
  with alteradas as (
    update public.obra_atividade set responsavel_id = null
    where obra_id = old.obra_id and responsavel_id = old.pessoa_id
      and concluida_em is null and deleted_at is null
    returning id
  ),
  eventos as (
    insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
    select id, 'responsavel', v_por,
      jsonb_build_object('responsavel_id', old.pessoa_id),
      jsonb_build_object('responsavel_id', null, 'motivo', 'saiu da obra')
    from alteradas
    returning 1
  )
  select count(*) into v_n from eventos;

  -- Tarefas abertas da pessoa nesta obra.
  with tarefas as (
    update public.tarefa set responsavel_id = null
    where obra_id = old.obra_id and responsavel_id = old.pessoa_id
      and status = 'aberta' and deleted_at is null
    returning id
  )
  insert into public.tarefa_evento (tarefa_id, tipo, por, antes, depois)
  select id, 'editada', v_por,
    jsonb_build_object('responsavel_id', old.pessoa_id),
    jsonb_build_object('responsavel_id', null, 'motivo', 'saiu da obra')
  from tarefas;

  -- Pendências abertas da pessoa nesta obra.
  with pendencias as (
    update public.pendencia set responsavel_id = null
    where obra_id = old.obra_id and responsavel_id = old.pessoa_id
      and status = 'aberta' and deleted_at is null
    returning id
  )
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  select id, 'responsavel_alterado', v_por,
    jsonb_build_object('antes', old.pessoa_id, 'depois', null, 'motivo', 'saiu da obra')
  from pendencias;

  select nome into v_obra from public.obra where id = old.obra_id and ambiente = 'geral';
  if v_n > 0 and v_obra is not null then
    select nome into v_nome from public.pessoa where id = old.pessoa_id;
    insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
    select 'atribuicao', (now() at time zone 'America/Sao_Paulo')::date, p.user_id,
      'CONTRO · ' || v_obra,
      coalesce(v_nome, 'Alguém') || ' saiu da obra. '
        || case when v_n = 1 then '1 atividade ficou sem responsável.'
                else v_n || ' atividades ficaram sem responsável.' end,
      '/?ir=geral-hoje'
    from public.pessoa p
    where p.ativo and p.deleted_at is null and p.user_id is not null
      and p.id <> old.pessoa_id and p.id is distinct from v_por
      and (p.administrador or (p.papel_geral = 'coordenador' and exists (
        select 1 from public.obra_participante op
        where op.obra_id = old.obra_id and op.pessoa_id = p.id)));
  end if;
  return old;
end;
$$;
revoke execute on function contro_obra_participante_sai() from public, anon, authenticated;
