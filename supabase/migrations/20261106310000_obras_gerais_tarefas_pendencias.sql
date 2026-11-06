-- Obras gerais · Etapa 4: tarefas e pendências abertas à obra geral, sem mudar
-- a Contorno. Cada função é cópia literal da versão mais recente; mudam só:
--   1) a entrada: contro_e_membro() vira contro_tem_acesso();
--   2) logo depois de achar a obra do item, contro_ve_obra(obra) (42501) para
--      as ações de qualquer participante, ou contro_planeja_obra(obra) (42501)
--      para as de quem planeja;
--   3) em obra geral, o responsável tem de participar da obra ou ser
--      Administrador (contro_valida_responsavel_geral, 22023), e a tarefa não
--      aceita nome livre (22023);
--   4) notificar_atribuicao_tarefa: em obra geral abre o Hoje de Obras gerais
--      (/?ir=geral-hoje) e só avisa responsável participante ou Administrador.
-- Decisões 3–4 do plano da etapa 4:
--   tarefa: salvar (criar/editar/atribuir), excluir e restaurar = quem planeja;
--           concluir, reabrir e informar avanço = qualquer participante.
--   pendência: apontar, resolver, editar, reabrir, excluir e restaurar =
--           qualquer participante; atribuir responsável = quem planeja.
-- Na Contorno, contro_ve_obra = contro_planeja_obra = contro_e_membro() (com a
-- obra não apagada): comportamento igual.
-- Origem das cópias:
--   salvar_tarefa                 20261104300000_log_score.sql
--   concluir_tarefa               20261104600000_concluir_atividade_fecha_tarefa.sql
--   reabrir_tarefa                20261024330000_subitem_tarefa_idempotente.sql
--   informar_avanco_tarefa        20261029100000_ata_colaborativa.sql
--   excluir_tarefa, restaurar_tarefa  20261024380000_excluir_tarefa_idempotente.sql
--   apontar_pendencia             20261024360000_apontar_idempotente.sql
--   resolver_pendencia            20261028160000_resolver_sem_vistoria.sql
--   editar_pendencia, excluir_pendencia, restaurar_pendencia
--                                 20261028120000_editar_excluir_pendencia.sql
--   reabrir_pendencia             20261028140000_reabrir_pendencia_fechada.sql
--   atribuir_pendencia            20261103160000_responsavel_checklist.sql
--   notificar_atribuicao_tarefa   20261103110000_notificar_atribuicao_tarefa.sql
-- Os grants permanecem, pois as assinaturas não mudam.

-- 1) Tarefas ---------------------------------------------------------------

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

  -- Tarefa já existente? (quando p_id é nulo, é sempre nova)
  if p_id is not null then
    select * into v_old from public.tarefa where id = p_id and deleted_at is null;
  end if;

  -- A obra é a da tarefa existente (edição) ou a informada (criação).
  v_obra := coalesce(v_old.obra_id, p_obra_id);
  if not public.contro_planeja_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if exists (select 1 from public.obra where id = v_obra and ambiente = 'geral') then
    if v_nome is not null then
      raise exception 'Responsável precisa participar da obra' using errcode = '22023';
    end if;
    perform public.contro_valida_responsavel_geral(v_obra, p_responsavel_id);
  end if;

  -- Nome digitado (sem login no app) vira sugestão de autocompletar.
  if v_nome is not null then
    insert into public.sugestao (tipo, texto) values ('pessoa', v_nome)
    on conflict (tipo, texto) do update set usos = public.sugestao.usos + 1, ultimo_uso = now();
  end if;

  if v_old.id is null then
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
    insert into public.tarefa (id, obra_id, texto, responsavel_id, responsavel_nome, observacao, prazo, vinculo_tipo, vinculo_id, origem_texto)
    values (coalesce(p_id, gen_random_uuid()), p_obra_id, p_texto, p_responsavel_id, v_nome, v_obs, p_prazo,
            p_vinculo_tipo, p_vinculo_id, p_origem_texto)
    on conflict (id) do nothing
    returning id into v_id;
    -- Chegar aqui com o id ocupado (e não ser reenvio, cortado pelo guard) é
    -- colisão/reuso do id do cliente: aborta e não grava evento órfão.
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

create or replace function concluir_tarefa(p_id uuid, p_client_op_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_t public.tarefa;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select * into v_t from public.tarefa where id = p_id and deleted_at is null;
  if v_t.id is null then
    raise exception 'Tarefa inválida' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(v_t.obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  -- Já feita (ex.: fechada junto com a atividade pela câmera): nada a fazer,
  -- sem segundo evento 'concluida'.
  if v_t.status = 'feita' then return; end if;
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

create or replace function reabrir_tarefa(p_id uuid, p_client_op_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_t public.tarefa; v_atv_concluida boolean;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select * into v_t from public.tarefa where id = p_id and deleted_at is null;
  if v_t.id is null then
    raise exception 'Tarefa inválida' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(v_t.obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
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

create or replace function informar_avanco_tarefa(
  p_id uuid,
  p_pct int,
  p_comentario text default null,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_t public.tarefa;
  v_com text := nullif(trim(coalesce(p_comentario, '')), '');
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if p_pct is null or p_pct < 0 or p_pct > 99 then
    raise exception 'Avanço de 0 a 99%% (100%% é concluir)' using errcode = '22023';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;

  select * into v_t from public.tarefa where id = p_id and deleted_at is null for update;
  if v_t.id is null then
    raise exception 'Tarefa inválida' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(v_t.obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if v_t.status = 'feita' then
    raise exception 'Tarefa já concluída' using errcode = '23505';
  end if;
  if v_t.avanco_pct = p_pct and v_t.comentario is not distinct from v_com then
    return;
  end if;

  v_pessoa := public.contro_pessoa_atual();
  update public.tarefa
  set avanco_pct = p_pct, comentario = v_com, avanco_em = now(), avanco_por = v_pessoa
  where id = p_id;
  insert into public.tarefa_evento (tarefa_id, tipo, por, antes, depois)
  values (p_id, 'avanco', v_pessoa,
          jsonb_build_object('pct', v_t.avanco_pct, 'comentario', v_t.comentario),
          jsonb_build_object('pct', p_pct, 'comentario', v_com));
end;
$$;

-- excluir/restaurar: a tarefa é achada com ou sem exclusão; id inexistente
-- segue como hoje (o evento falha na FK, 23503).
create or replace function excluir_tarefa(p_id uuid, p_client_op_id uuid default null)
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
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select obra_id into v_obra from public.tarefa where id = p_id;
  if v_obra is not null and not public.contro_planeja_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  v_pessoa := public.contro_pessoa_atual();
  update public.tarefa set deleted_at = now() where id = p_id and deleted_at is null;
  insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'excluida', v_pessoa);
end;
$$;

create or replace function restaurar_tarefa(p_id uuid, p_client_op_id uuid default null)
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
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select obra_id into v_obra from public.tarefa where id = p_id;
  if v_obra is not null and not public.contro_planeja_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  v_pessoa := public.contro_pessoa_atual();
  update public.tarefa set deleted_at = null where id = p_id;
  insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'restaurada', v_pessoa);
end;
$$;

-- 2) Pendências ------------------------------------------------------------

create or replace function apontar_pendencia(
  p_id uuid,
  p_obra_id uuid,
  p_titulo text,
  p_local text,
  p_criticidade text,
  p_foto_antes_id uuid,
  p_atividade_id uuid default null,
  p_client_op_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_topo numeric; v_id uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return p_id; end if;
  if not public.contro_ve_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if p_foto_antes_id is null or not exists (
    select 1 from public.foto where id = p_foto_antes_id and obra_id = p_obra_id
  ) then
    raise exception 'Apontar exige foto da obra' using errcode = '23503';
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
    apontada_por, status, ordem_fila
  ) values (
    p_id, p_obra_id, p_atividade_id, p_titulo, p_local,
    coalesce(p_criticidade, 'media'), p_foto_antes_id, v_pessoa, 'aberta', v_topo
  )
  on conflict (id) do nothing
  returning id into v_id;
  -- Reenvio da MESMA op já é cortado pelo guard acima; chegar aqui com o id
  -- ocupado é colisão/reuso indevido do id do cliente. Aborta (terminal) e não
  -- grava evento sobre uma pendência que não foi inserida nesta chamada.
  if v_id is null then
    raise exception 'Pendência com esse id já existe' using errcode = '23505';
  end if;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (p_id, 'apontada', v_pessoa, jsonb_build_object('foto_antes_id', p_foto_antes_id));
  return p_id;
end;
$$;

create or replace function resolver_pendencia(
  p_id uuid,
  p_foto_depois_id uuid,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_obra uuid; v_status text;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select obra_id, status into v_obra, v_status
  from public.pendencia where id = p_id and deleted_at is null;
  if v_obra is null then
    raise exception 'Pendência inválida' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if v_status <> 'aberta' then
    raise exception 'Só resolve pendência aberta' using errcode = '42501';
  end if;
  if p_foto_depois_id is null or not exists (
    select 1 from public.foto where id = p_foto_depois_id and obra_id = v_obra
  ) then
    raise exception 'Resolver exige foto de depois da obra' using errcode = '23503';
  end if;
  v_pessoa := public.contro_pessoa_atual();
  update public.pendencia
  set status = 'fechada', foto_depois_id = p_foto_depois_id,
      resolvida_por = v_pessoa, resolvida_em = now()
  where id = p_id;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (p_id, 'resolvida', v_pessoa, jsonb_build_object('foto_depois_id', p_foto_depois_id));
end;
$$;

create or replace function editar_pendencia(
  p_id uuid,
  p_titulo text,
  p_local text,
  p_criticidade text,
  p_atividade_id uuid default null,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid;
  v_antes jsonb;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select obra_id, jsonb_build_object('titulo', titulo, 'local', local,
           'criticidade', criticidade, 'atividade_id', atividade_id)
  into v_obra, v_antes
  from public.pendencia where id = p_id and deleted_at is null
  for update;
  if v_obra is null then
    raise exception 'Pendência não encontrada' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if coalesce(trim(p_titulo), '') = '' then
    raise exception 'Título obrigatório' using errcode = '23514';
  end if;
  if coalesce(p_criticidade, 'media') not in ('alta', 'media', 'baixa') then
    raise exception 'Criticidade inválida' using errcode = '23514';
  end if;
  if p_atividade_id is not null and not exists (
    select 1 from public.obra_atividade where id = p_atividade_id and obra_id = v_obra
  ) then
    raise exception 'Atividade não é desta obra' using errcode = '23503';
  end if;

  update public.pendencia
  set titulo = trim(p_titulo),
      local = nullif(trim(coalesce(p_local, '')), ''),
      criticidade = coalesce(p_criticidade, 'media'),
      atividade_id = p_atividade_id
  where id = p_id;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (p_id, 'editada', public.contro_pessoa_atual(), jsonb_build_object('antes', v_antes));
end;
$$;

create or replace function reabrir_pendencia(
  p_id uuid,
  p_manter_foto boolean,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid;
  v_status text;
  v_foto uuid;
  v_topo numeric;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select obra_id, status, foto_depois_id into v_obra, v_status, v_foto
  from public.pendencia where id = p_id and deleted_at is null
  for update;
  if v_obra is null then
    raise exception 'Pendência inválida' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if v_status <> 'fechada' then
    raise exception 'Só volta para pendente uma pendência concluída' using errcode = '42501';
  end if;

  select coalesce(min(ordem_fila), 0) - 1 into v_topo from public.pendencia where obra_id = v_obra;
  update public.pendencia
  set status = 'aberta',
      foto_depois_id = case when p_manter_foto then foto_depois_id else null end,
      resolvida_por = null, resolvida_em = null,
      vistoriada_por = null, vistoriada_em = null,
      adiada_ate = null, motivo_adiamento = null,
      ordem_fila = v_topo
  where id = p_id;
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  values (p_id, 'reaberta', public.contro_pessoa_atual(),
          jsonb_build_object('de', 'fechada', 'foto_depois_id', v_foto, 'manteve_foto', p_manter_foto));
end;
$$;

-- excluir/restaurar: a pendência é achada com ou sem exclusão; id inexistente
-- segue como hoje (23503 do "not found").
create or replace function excluir_pendencia(p_id uuid, p_client_op_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_obra uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select obra_id into v_obra from public.pendencia where id = p_id;
  if v_obra is not null and not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  update public.pendencia set deleted_at = now() where id = p_id and deleted_at is null;
  if not found then
    raise exception 'Pendência não encontrada' using errcode = '23503';
  end if;
  insert into public.pendencia_evento (pendencia_id, tipo, por)
  values (p_id, 'excluida', public.contro_pessoa_atual());
end;
$$;

create or replace function restaurar_pendencia(p_id uuid, p_client_op_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_obra uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select obra_id into v_obra from public.pendencia where id = p_id;
  if v_obra is not null and not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  update public.pendencia set deleted_at = null where id = p_id and deleted_at is not null;
  if not found then
    raise exception 'Pendência não está apagada' using errcode = '23503';
  end if;
  insert into public.pendencia_evento (pendencia_id, tipo, por)
  values (p_id, 'restaurada', public.contro_pessoa_atual());
end;
$$;

create or replace function public.atribuir_pendencia(
  p_id uuid, p_responsavel_id uuid, p_client_op_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_anterior uuid; v_pessoa uuid; v_obra uuid;
begin
  if not public.contro_tem_acesso() then raise exception 'Apenas membros' using errcode = '42501'; end if;
  v_pessoa := public.contro_pessoa_atual();
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select responsavel_id, obra_id into v_anterior, v_obra from public.pendencia
    where id = p_id and deleted_at is null for update;
  if not found then raise exception 'Pendência não encontrada' using errcode = '23503'; end if;
  if not public.contro_planeja_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if exists (select 1 from public.obra where id = v_obra and ambiente = 'geral') then
    perform public.contro_valida_responsavel_geral(v_obra, p_responsavel_id);
  end if;
  if p_responsavel_id is not null and not exists (
    select 1 from public.pessoa where id = p_responsavel_id and ativo and deleted_at is null
  ) then raise exception 'Escolha um responsável ativo' using errcode = '23514'; end if;
  if v_anterior is not distinct from p_responsavel_id then return; end if;
  update public.pendencia set responsavel_id = p_responsavel_id where id = p_id;
  insert into public.pendencia_evento(pendencia_id,tipo,por,dados)
  values(p_id,'responsavel_alterado',v_pessoa,jsonb_build_object('antes',v_anterior,'depois',p_responsavel_id));
end;
$$;

-- 3) Aviso de tarefa atribuída ---------------------------------------------
-- Obra geral: abre o Hoje de Obras gerais e só avisa quem participa da obra
-- ou é Administrador. Contorno: igual a hoje.
create or replace function public.notificar_atribuicao_tarefa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_obra text; v_geral boolean;
begin
  if new.responsavel_id is null or new.deleted_at is not null or new.status <> 'aberta' then
    return new;
  end if;
  if TG_OP = 'UPDATE' then
    if new.responsavel_id is not distinct from old.responsavel_id then return new; end if;
  end if;
  select nome, ambiente = 'geral' into v_obra, v_geral from public.obra where id = new.obra_id;
  select p.user_id into v_user from public.pessoa p
    where p.id = new.responsavel_id and p.ativo and p.deleted_at is null
      and (not coalesce(v_geral, false) or p.administrador or exists (
        select 1 from public.obra_participante op
        where op.obra_id = new.obra_id and op.pessoa_id = p.id
      ));
  if v_user is null then return new; end if;
  insert into public.aviso_disparo(tipo,dia,user_id,titulo,corpo,url)
  values ('atribuicao', (now() at time zone 'America/Sao_Paulo')::date, v_user,
    'CONTRO · Tarefa atribuída a você',
    new.texto || ' · ' || coalesce(v_obra, 'Obra') || ' · Prazo: ' || to_char(new.prazo, 'DD/MM/YYYY'),
    case when coalesce(v_geral, false) then '/?ir=geral-hoje' else '/?ir=minhas' end);
  return new;
end;
$$;
revoke all on function public.notificar_atribuicao_tarefa() from public, anon, authenticated;
