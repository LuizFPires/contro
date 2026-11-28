-- Obras gerais · prazos livres (pedido do usuário, 28/11/2026): qualquer pessoa
-- que vê a obra geral (Membro, Coordenador, Administrador) muda as datas e os
-- prazos, sem depender de quem planeja: início e término da atividade (e os
-- Desfazer), data do subitem, prazo da tarefa e data limite da pendência.
-- Continua só de quem planeja: criar e excluir fase, atividade e subitem, nome,
-- responsável, prestador, texto da tarefa e pessoas da obra.
-- O rastro não muda: replanejar segue contando e pedindo o motivo, e o término
-- não fica antes do início.

-- Quem vê a obra geral. Obra inexistente → 23503; obra Contorno → 23505.
create or replace function contro_exige_ver_obra_geral(p_obra_id uuid)
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
  if not public.contro_ve_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function contro_exige_ver_obra_geral(uuid) from public, anon;
grant execute on function contro_exige_ver_obra_geral(uuid) to authenticated;

-- Início previsto: igual a 20261124100000, com a checagem de quem vê a obra.
create or replace function definir_inicio_previsto(p_atividade_id uuid, p_data date, p_motivo text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atv public.obra_atividade%rowtype;
  v_pessoa uuid;
  v_evento uuid;
  v_fim date;
  v_motivo text := left(nullif(btrim(coalesce(p_motivo, '')), ''), 120);
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select * into v_atv from public.obra_atividade
  where id = p_atividade_id and pai_id is null and deleted_at is null
  for update;
  if not found then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  perform public.contro_exige_ver_obra_geral(v_atv.obra_id);
  if p_data is not distinct from v_atv.data_inicio then
    return null;
  end if;
  if p_data is null and v_atv.concluida_em is null then
    raise exception 'Não dá para tirar a data; use Desfazer' using errcode = '22023';
  end if;
  v_fim := public.contro_termino_atividade(p_atividade_id);
  if p_data is not null and v_fim is not null and p_data > v_fim then
    raise exception 'O início fica depois do término' using errcode = '22023';
  end if;
  if v_atv.concluida_em is null and v_atv.data_inicio is not null and v_motivo is null then
    raise exception 'Informe o motivo da mudança' using errcode = '22023';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade set data_inicio = p_data where id = p_atividade_id;
  if v_atv.concluida_em is null and v_atv.data_inicio is not null then
    insert into public.obra_atividade_evento (atividade_id, tipo, por, em, antes, depois)
    values (p_atividade_id, 'inicio_ajustado', v_pessoa, clock_timestamp(),
      jsonb_build_object('inicio', v_atv.data_inicio),
      jsonb_strip_nulls(jsonb_build_object('inicio', p_data, 'motivo', v_motivo)))
    returning id into v_evento;
  else
    insert into public.obra_atividade_evento (atividade_id, tipo, por, em, antes, depois)
    values (p_atividade_id, 'inicio_definido', v_pessoa, clock_timestamp(),
      jsonb_build_object('inicio', v_atv.data_inicio),
      jsonb_build_object('inicio', p_data))
    returning id into v_evento;
  end if;
  return v_evento;
end;
$$;

create or replace function desfazer_inicio_previsto(p_evento_id uuid)
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
  select * into v_atv from public.obra_atividade
  where id = v_ev.atividade_id and deleted_at is null
  for update;
  if not found then
    raise exception 'Não dá mais para desfazer' using errcode = '22023';
  end if;
  perform public.contro_exige_ver_obra_geral(v_atv.obra_id);
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  if v_ev.tipo not in ('inicio_definido', 'inicio_ajustado')
     or v_ev.por is distinct from v_pessoa
     or v_ev.em < now() - interval '10 minutes'
     or not (coalesce(v_ev.antes, '{}'::jsonb) ? 'inicio')
     or exists (
       select 1 from public.obra_atividade_evento e
       where e.atividade_id = v_ev.atividade_id and e.id <> v_ev.id
         and e.tipo in ('inicio_definido', 'inicio_ajustado', 'inicio_desfeito')
         and e.em >= v_ev.em
     ) then
    raise exception 'Não dá mais para desfazer' using errcode = '22023';
  end if;
  update public.obra_atividade set data_inicio = (v_ev.antes ->> 'inicio')::date where id = v_atv.id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, em, antes, depois)
  values (v_atv.id, 'inicio_desfeito', v_pessoa, clock_timestamp(),
    jsonb_build_object('inicio', v_atv.data_inicio),
    v_ev.antes || jsonb_build_object('evento_id', v_ev.id));
end;
$$;

-- Término (data prevista): igual a 20261124100000, com a checagem de quem vê a obra.
create or replace function definir_data_prevista(p_atividade_id uuid, p_data date, p_motivo text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid;
  v_inicio date;
  v_data date;
  v_concluida timestamptz;
  v_motivo text := left(nullif(btrim(coalesce(p_motivo, '')), ''), 120);
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select obra_id, data_inicio, data_prevista, concluida_em into v_obra, v_inicio, v_data, v_concluida
  from public.obra_atividade where id = p_atividade_id and deleted_at is null;
  if v_obra is null then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  perform public.contro_exige_ver_obra_geral(v_obra);
  if p_data is not null and v_inicio is not null and p_data < v_inicio then
    raise exception 'O término fica antes do início' using errcode = '22023';
  end if;
  if v_concluida is null and v_data is not null and p_data is not null
     and p_data <> v_data and v_motivo is null then
    raise exception 'Informe o motivo da mudança' using errcode = '22023';
  end if;
  return public.contro_aplica_data_prevista(p_atividade_id, p_data, v_motivo);
end;
$$;

-- Desfazer do término: igual a 20261106100000, com a checagem de quem vê a obra.
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
  perform public.contro_exige_ver_obra_geral(v_atv.obra_id);
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

-- Subitem: a data é de qualquer um que vê a obra; o nome segue de quem planeja.
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
  perform public.contro_exige_ver_obra_geral(v_sub.obra_id);
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
    perform public.contro_exige_planejar_geral(v_sub.obra_id);
    select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
    update public.obra_atividade set nome = v_nome where id = p_subitem_id;
    insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
    values (p_subitem_id, 'editada', v_pessoa,
      jsonb_build_object('nome', v_sub.nome), jsonb_build_object('nome', v_nome));
  end if;
  return public.contro_aplica_data_prevista(p_subitem_id, p_data_prevista, null);
end;
$$;

-- Data limite da pendência: qualquer um que vê a obra (nos dois ambientes).
create or replace function public.definir_prazo_pendencia(
  p_id uuid,
  p_prazo date,
  p_client_op_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_obra uuid; v_antes date;
begin
  if not public.contro_tem_acesso() then raise exception 'Apenas membros' using errcode = '42501'; end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select pe.obra_id, pe.prazo into v_obra, v_antes
    from public.pendencia pe
    where pe.id = p_id and pe.deleted_at is null for update of pe;
  if v_obra is null then raise exception 'Pendência não encontrada' using errcode = '23503'; end if;
  if not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if v_antes is not distinct from p_prazo then return; end if;
  update public.pendencia set prazo = p_prazo where id = p_id;
  insert into public.pendencia_evento(pendencia_id, tipo, por, dados)
  values (p_id, 'prazo_alterado', public.contro_pessoa_atual(),
    jsonb_build_object('antes', v_antes, 'depois', p_prazo));
end;
$$;

-- Apontar com data limite: qualquer um (sem a trava de quem planeja na obra geral).
create or replace function public.contro_criar_pendencia(
  p_id uuid,
  p_obra_id uuid,
  p_titulo text,
  p_local text,
  p_criticidade text,
  p_foto_antes_id uuid,
  p_atividade_id uuid,
  p_prazo date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_topo numeric; v_id uuid;
begin
  if p_foto_antes_id is not null and not exists (
    select 1 from public.foto where id = p_foto_antes_id and obra_id = p_obra_id
  ) then
    raise exception 'Foto não é desta obra' using errcode = '23503';
  end if;
  if coalesce(trim(p_titulo), '') = '' then
    raise exception 'Título obrigatório' using errcode = '23514';
  end if;
  if p_atividade_id is not null and not exists (
    select 1 from public.obra_atividade where id = p_atividade_id and obra_id = p_obra_id
  ) then
    raise exception 'Atividade não é desta obra' using errcode = '23503';
  end if;
  v_pessoa := public.contro_pessoa_atual();
  select coalesce(min(ordem_fila), 0) - 1 into v_topo from public.pendencia where obra_id = p_obra_id;
  insert into public.pendencia (
    id, obra_id, atividade_id, titulo, local, criticidade, foto_antes_id,
    apontada_por, status, ordem_fila, prazo
  ) values (
    p_id, p_obra_id, p_atividade_id, p_titulo, p_local,
    coalesce(p_criticidade, 'media'), p_foto_antes_id, v_pessoa, 'aberta', v_topo, p_prazo
  )
  on conflict (id) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'Pendência com esse id já existe' using errcode = '23505';
  end if;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (p_id, 'apontada', v_pessoa,
    jsonb_build_object('foto_antes_id', p_foto_antes_id, 'prazo', p_prazo));
  return p_id;
end;
$$;
revoke execute on function public.contro_criar_pendencia(uuid, uuid, text, text, text, uuid, uuid, date)
  from public, anon, authenticated;

-- Tarefa: quem não planeja (mas vê a obra) muda só o prazo de tarefa aberta
-- existente (texto, observação e vínculo enviados são ignorados; trocar o
-- responsável dá 42501). O resto
-- é igual a 20261106400000.
create or replace function salvar_tarefa(
  p_id uuid,
  p_obra_id uuid,
  p_texto text,
  p_responsavel_id uuid,
  p_prazo date,
  p_vinculo_tipo text default null,
  p_vinculo_id uuid default null,
  p_origem_texto text default null,
  p_client_op_id uuid default null,
  p_observacao text default null,
  p_responsavel_nome text default null,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_id uuid; v_old public.tarefa;
  v_nome text := nullif(trim(coalesce(p_responsavel_nome, '')), '');
  v_obs text := nullif(trim(coalesce(p_observacao, '')), '');
  v_obra uuid;
  v_ambiente text := 'contorno';
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return p_id; end if;
  if coalesce(trim(p_texto), '') = '' then
    raise exception 'Texto obrigatório' using errcode = '23514';
  end if;
  if p_prazo is null then
    raise exception 'Prazo obrigatório' using errcode = '23514';
  end if;
  v_pessoa := public.contro_pessoa_atual();
  if p_responsavel_id is not null then v_nome := null; end if;

  if p_id is not null then
    select * into v_old from public.tarefa where id = p_id and deleted_at is null;
  end if;

  v_obra := coalesce(v_old.obra_id, p_obra_id);
  if not public.contro_planeja_obra(v_obra) then
    -- Prazo livre: quem vê a obra replaneja o prazo da tarefa aberta (só o prazo).
    -- O texto vem normalizado da tela (pode diferir do gravado) e é ignorado;
    -- trocar o responsável é atribuir, e segue de quem planeja.
    if v_old.id is null or v_old.status <> 'aberta' or not public.contro_ve_obra(v_obra)
       or p_responsavel_id is distinct from v_old.responsavel_id then
      raise exception 'sem acesso a esta obra' using errcode = '42501';
    end if;
    if p_prazo is distinct from v_old.prazo then
      update public.tarefa
      set prazo = p_prazo,
          prazo_original = coalesce(prazo_original, v_old.prazo),
          replanejamentos = replanejamentos + 1
      where id = p_id;
      insert into public.tarefa_evento (tarefa_id, tipo, por, antes, depois)
      values (p_id, 'replanejada', v_pessoa,
              jsonb_build_object('prazo', v_old.prazo),
              jsonb_build_object('prazo', p_prazo, 'motivo', nullif(left(btrim(p_motivo), 120), '')));
    end if;
    return p_id;
  end if;
  if exists (select 1 from public.obra where id = v_obra and ambiente = 'geral') then
    v_ambiente := 'geral';
    perform public.contro_valida_responsavel_geral(v_obra, p_responsavel_id);
  end if;

  if v_nome is not null then
    insert into public.sugestao (ambiente, tipo, texto) values (v_ambiente, 'pessoa', v_nome)
    on conflict (ambiente, tipo, texto) do update set usos = public.sugestao.usos + 1, ultimo_uso = now();
  end if;

  if v_old.id is null then
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
    insert into public.tarefa (id, obra_id, texto, responsavel_id, responsavel_nome, observacao, prazo, vinculo_tipo, vinculo_id, origem_texto)
    values (coalesce(p_id, gen_random_uuid()), p_obra_id, p_texto, p_responsavel_id, v_nome, v_obs, p_prazo,
            p_vinculo_tipo, p_vinculo_id, p_origem_texto)
    on conflict (id) do nothing
    returning id into v_id;
    if v_id is null then
      raise exception 'Tarefa com esse id já existe' using errcode = '23505';
    end if;
    insert into public.tarefa_evento (tarefa_id, tipo, por) values (v_id, 'criada', v_pessoa);
    return v_id;
  end if;

  if v_old.status = 'aberta' and p_prazo is distinct from v_old.prazo then
    update public.tarefa
    set texto = p_texto, responsavel_id = p_responsavel_id, responsavel_nome = v_nome,
        observacao = v_obs, prazo = p_prazo,
        prazo_original = coalesce(prazo_original, v_old.prazo),
        replanejamentos = replanejamentos + 1
    where id = p_id;
    insert into public.tarefa_evento (tarefa_id, tipo, por, antes, depois)
    values (p_id, 'replanejada', v_pessoa,
            jsonb_build_object('prazo', v_old.prazo),
            jsonb_build_object('prazo', p_prazo, 'motivo', nullif(left(btrim(p_motivo), 120), '')));
  else
    update public.tarefa
    set texto = p_texto, responsavel_id = p_responsavel_id, responsavel_nome = v_nome,
        observacao = v_obs, prazo = p_prazo
    where id = p_id;
    insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'editada', v_pessoa);
  end if;
  return p_id;
end;
$$;
