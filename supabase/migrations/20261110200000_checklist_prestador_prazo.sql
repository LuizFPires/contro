-- Check list e Avaliação (relato de campo, Divinópolis, 10/11/2026).
--
-- 1) Responsável prestador: a pendência aceita um nome digitado (quem não tem
--    login no app), como a tarefa. Pessoa do app pelo id OU nome livre; o nome
--    vira sugestão de autocompletar ('pessoa') do ambiente da obra.
-- 2) Data limite: pendencia.prazo (opcional). Com ela, vale no lugar do prazo
--    calculado pela criticidade (core prazoPendencia), em tudo: card, PDF,
--    Hoje, Log, Score e os avisos do dia. Obra geral: só quem planeja define.
-- 3) Avaliação: tocar "Não" grava o não conforme na hora e cria a pendência
--    mesmo sem a foto do antes; a foto entra depois (anexar_foto_antes_pendencia).
--    No Check list, apontar continua exigindo a foto.

alter table public.pendencia add column responsavel_nome text;
alter table public.pendencia add column prazo date;

-- Inserção comum (sem checagens de acesso: quem chama já checou).
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
  if p_prazo is not null and exists (
    select 1 from public.obra where id = p_obra_id and ambiente = 'geral'
  ) and not public.contro_planeja_obra(p_obra_id) then
    raise exception 'Só quem planeja a obra define a data limite' using errcode = '42501';
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
  -- Id ocupado: colisão/reuso indevido do id do cliente (o reenvio da mesma op
  -- já foi cortado por quem chamou). Aborta sem gravar evento.
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

-- Apontar no Check list: continua exigindo a foto do antes; ganha a data limite.
drop function public.apontar_pendencia(uuid, uuid, text, text, text, uuid, uuid, uuid);
create function public.apontar_pendencia(
  p_id uuid,
  p_obra_id uuid,
  p_titulo text,
  p_local text,
  p_criticidade text,
  p_foto_antes_id uuid,
  p_atividade_id uuid default null,
  p_client_op_id uuid default null,
  p_prazo date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return p_id; end if;
  if not public.contro_ve_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if p_foto_antes_id is null then
    raise exception 'Apontar exige foto da obra' using errcode = '23503';
  end if;
  return public.contro_criar_pendencia(
    p_id, p_obra_id, p_titulo, p_local, p_criticidade, p_foto_antes_id, p_atividade_id, p_prazo
  );
end;
$$;
revoke execute on function public.apontar_pendencia(uuid, uuid, text, text, text, uuid, uuid, uuid, date)
  from public, anon;
grant execute on function public.apontar_pendencia(uuid, uuid, text, text, text, uuid, uuid, uuid, date)
  to authenticated;

-- Responsável: pessoa do app (id) OU nome digitado (prestador, sem login).
drop function public.atribuir_pendencia(uuid, uuid, uuid);
create function public.atribuir_pendencia(
  p_id uuid,
  p_responsavel_id uuid,
  p_client_op_id uuid default null,
  p_responsavel_nome text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_ant_id uuid; v_ant_nome text; v_pessoa uuid; v_obra uuid; v_ambiente text;
  v_nome text := nullif(trim(coalesce(p_responsavel_nome, '')), '');
begin
  if not public.contro_tem_acesso() then raise exception 'Apenas membros' using errcode = '42501'; end if;
  v_pessoa := public.contro_pessoa_atual();
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  if p_responsavel_id is not null then v_nome := null; end if;
  select pe.responsavel_id, pe.responsavel_nome, pe.obra_id, o.ambiente
    into v_ant_id, v_ant_nome, v_obra, v_ambiente
    from public.pendencia pe join public.obra o on o.id = pe.obra_id
    where pe.id = p_id and pe.deleted_at is null for update of pe;
  if not found then raise exception 'Pendência não encontrada' using errcode = '23503'; end if;
  if not public.contro_planeja_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if v_ambiente = 'geral' then
    perform public.contro_valida_responsavel_geral(v_obra, p_responsavel_id);
    -- Obra geral: responsável é pessoa da obra (como na tarefa), sem nome livre.
    if v_nome is not null then
      raise exception 'Na obra geral o responsável é uma pessoa da obra' using errcode = '22023';
    end if;
  end if;
  if p_responsavel_id is not null and not exists (
    select 1 from public.pessoa where id = p_responsavel_id and ativo and deleted_at is null
  ) then raise exception 'Escolha um responsável ativo' using errcode = '23514'; end if;
  if v_ant_id is not distinct from p_responsavel_id and v_ant_nome is not distinct from v_nome then
    return;
  end if;
  if v_nome is not null then
    insert into public.sugestao (ambiente, tipo, texto)
    values (coalesce(v_ambiente, 'contorno'), 'pessoa', v_nome)
    on conflict (ambiente, tipo, texto) do update set usos = public.sugestao.usos + 1, ultimo_uso = now();
  end if;
  update public.pendencia set responsavel_id = p_responsavel_id, responsavel_nome = v_nome
  where id = p_id;
  insert into public.pendencia_evento(pendencia_id, tipo, por, dados)
  values (p_id, 'responsavel_alterado', v_pessoa, jsonb_build_object(
    'antes', v_ant_id, 'depois', p_responsavel_id,
    'antes_nome', v_ant_nome, 'depois_nome', v_nome));
end;
$$;
revoke all on function public.atribuir_pendencia(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.atribuir_pendencia(uuid, uuid, uuid, text) to authenticated;

-- Data limite (null = volta ao prazo da criticidade). Obra geral: quem planeja.
create or replace function public.definir_prazo_pendencia(
  p_id uuid,
  p_prazo date,
  p_client_op_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_obra uuid; v_antes date; v_geral boolean;
begin
  if not public.contro_tem_acesso() then raise exception 'Apenas membros' using errcode = '42501'; end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select pe.obra_id, pe.prazo, o.ambiente = 'geral' into v_obra, v_antes, v_geral
    from public.pendencia pe join public.obra o on o.id = pe.obra_id
    where pe.id = p_id and pe.deleted_at is null for update of pe;
  if v_obra is null then raise exception 'Pendência não encontrada' using errcode = '23503'; end if;
  if not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if v_geral and not public.contro_planeja_obra(v_obra) then
    raise exception 'Só quem planeja a obra define a data limite' using errcode = '42501';
  end if;
  if v_antes is not distinct from p_prazo then return; end if;
  update public.pendencia set prazo = p_prazo where id = p_id;
  insert into public.pendencia_evento(pendencia_id, tipo, por, dados)
  values (p_id, 'prazo_alterado', public.contro_pessoa_atual(),
    jsonb_build_object('antes', v_antes, 'depois', p_prazo));
end;
$$;
revoke all on function public.definir_prazo_pendencia(uuid, date, uuid) from public, anon;
grant execute on function public.definir_prazo_pendencia(uuid, date, uuid) to authenticated;

-- Foto do antes depois (pendência criada pelo "Não" da Avaliação sem foto).
create or replace function public.anexar_foto_antes_pendencia(
  p_id uuid,
  p_foto_antes_id uuid,
  p_client_op_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_obra uuid; v_atual uuid;
begin
  if not public.contro_tem_acesso() then raise exception 'Apenas membros' using errcode = '42501'; end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  select obra_id, foto_antes_id into v_obra, v_atual
    from public.pendencia where id = p_id and deleted_at is null for update;
  if v_obra is null then raise exception 'Pendência não encontrada' using errcode = '23503'; end if;
  if not public.contro_ve_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if p_foto_antes_id is null or not exists (
    select 1 from public.foto where id = p_foto_antes_id and obra_id = v_obra
  ) then
    raise exception 'Foto não é desta obra' using errcode = '23503';
  end if;
  -- A foto do antes é a prova do problema: só entra onde ainda não há uma.
  if v_atual is not null then
    raise exception 'A pendência já tem a foto do antes' using errcode = '23514';
  end if;
  update public.pendencia set foto_antes_id = p_foto_antes_id where id = p_id;
  insert into public.pendencia_evento(pendencia_id, tipo, por, dados)
  values (p_id, 'foto_antes', public.contro_pessoa_atual(),
    jsonb_build_object('foto_antes_id', p_foto_antes_id));
end;
$$;
revoke all on function public.anexar_foto_antes_pendencia(uuid, uuid, uuid) from public, anon;
grant execute on function public.anexar_foto_antes_pendencia(uuid, uuid, uuid) to authenticated;

-- "Não" da Avaliação: cria a pendência com ou sem a foto do antes.
create or replace function avaliacao_nao_conforme(
  p_item_id uuid,
  p_pendencia_id uuid,
  p_titulo text default null,
  p_local text default null,
  p_criticidade text default 'media',
  p_foto_antes_id uuid default null,
  p_client_op_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.avaliacao_item;
  v_status text;
  v_pend uuid;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return p_pendencia_id; end if;
  v_item := public.contro_avaliacao_item_aberto(p_item_id);

  select id, status into v_pend, v_status from public.pendencia
  where id = v_item.pendencia_id and deleted_at is null;

  if v_pend is null then
    v_pend := public.contro_criar_pendencia(
      p_pendencia_id, v_item.obra_id, coalesce(nullif(trim(p_titulo), ''), v_item.nome),
      coalesce(nullif(trim(p_local), ''), v_item.secao), p_criticidade, p_foto_antes_id, null, null
    );
  elsif v_status = 'fechada' then
    perform public.reabrir_pendencia(v_pend, false);
  end if;

  update public.avaliacao_item
  set resultado = 'nao_conforme', reconfirmar = false, pendencia_id = v_pend,
      respondido_por = public.contro_pessoa_atual(), respondido_em = now()
  where id = p_item_id;
  return v_pend;
end;
$$;

-- Avisos do dia: a data limite da pendência vale no lugar do prazo da
-- criticidade, e o nome digitado (prestador) conta como o da tarefa.
-- Cópia literal das versões em vigor, com só essas trocas:
--   gerar_avisos         20261105230000_obras_gerais_rotinas.sql
--   gerar_avisos_gerais  20261106320000_obras_gerais_avisos_obra.sql

create or replace function gerar_avisos(p_agora timestamptz default now())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.config_avisos;
  v_hoje date := (p_agora at time zone 'America/Sao_Paulo')::date;
  v_hora time := (p_agora at time zone 'America/Sao_Paulo')::time;
  v_dow int := extract(isodow from (p_agora at time zone 'America/Sao_Paulo'));
  v_obras int;
  v_antes time;
  v_n int := 0;
  v_k int;
begin
  select * into c from public.config_avisos where id;
  if not found then return 0; end if;
  select count(*) into v_obras from public.obra where status = 'ativa' and deleted_at is null and ambiente = 'contorno';

  -- Lembretes da reunião (para todos), só no dia dela.
  if v_dow = c.reuniao_dia then
    if c.manha_ativo and v_hora >= c.manha_hora and v_hora < c.manha_hora + interval '3 hours'
       and c.manha_hora < c.reuniao_hora then
      insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
      select 'reuniao_manha', v_hoje, p.user_id, 'CONTRO · Reunião',
        'Reunião hoje às ' || public.contro_hora_curta(c.reuniao_hora) || '. '
          || v_obras || case when v_obras = 1 then ' obra' else ' obras' end
          || ' na pauta. Prepare as providências da semana.',
        '/?ir=reuniao'
      from public.pessoa p
      where p.ativo and p.deleted_at is null and p.acesso_contorno and p.user_id is not null
      on conflict (tipo, dia, user_id) where tipo <> 'atribuicao' do nothing;
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end if;
    v_antes := c.reuniao_hora - make_interval(mins => c.antes_min);
    if c.antes_ativo and v_hora >= v_antes and v_hora < c.reuniao_hora then
      insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
      select 'reuniao_antes', v_hoje, p.user_id, 'CONTRO · Reunião',
        'Começa em ' || case c.antes_min when 30 then '30 min' when 60 then '1 hora' else '2 horas' end
          || ' (' || public.contro_hora_curta(c.reuniao_hora) || '). Toque para abrir a pauta.',
        '/?ir=reuniao'
      from public.pessoa p
      where p.ativo and p.deleted_at is null and p.acesso_contorno and p.user_id is not null
      on conflict (tipo, dia, user_id) where tipo <> 'atribuicao' do nothing;
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end if;
  end if;

  -- Avisos do dia: segunda a sexta.
  if v_dow between 1 and 5 then
    -- Ações de hoje (equipe, só as suas) e Equipe hoje (gestor, todas).
    if c.acoes_ativo and v_hora >= c.acoes_hora and v_hora < c.acoes_hora + interval '3 hours' then
      insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
      with acoes as (
        select t.responsavel_id as pessoa_id, nullif(t.responsavel_nome, '') as nome_digitado, t.prazo
        from public.tarefa t
        join public.obra o on o.id = t.obra_id and o.status = 'ativa' and o.deleted_at is null and o.ambiente = 'contorno'
        where t.status = 'aberta' and t.deleted_at is null
        union all
        select pe.responsavel_id, nullif(pe.responsavel_nome, ''),
          coalesce(pe.prazo, public.contro_prazo_pendencia(pe.criticidade, pe.apontada_em, c))
        from public.pendencia pe
        join public.obra o on o.id = pe.obra_id and o.status = 'ativa' and o.deleted_at is null and o.ambiente = 'contorno'
        where pe.status = 'aberta' and pe.deleted_at is null
        union all
        -- Providência sem dono: pendente, com prazo gravado pelo app, atividade
        -- aberta e sem tarefa vinculada aberta (a tarefa a representa).
        select null::uuid, null::text, op.providenciar_ate
        from public.obra_providencia op
        join public.obra o on o.id = op.obra_id and o.status = 'ativa' and o.deleted_at is null and o.ambiente = 'contorno'
        join public.obra_atividade oa on oa.id = op.atividade_id
          and oa.concluida_em is null and oa.deleted_at is null
        where op.status = 'pendente' and op.deleted_at is null and op.providenciar_ate is not null
          and not exists (
            select 1 from public.tarefa t
            where t.vinculo_tipo = 'providencia' and t.vinculo_id = op.id
              and t.status = 'aberta' and t.deleted_at is null
          )
        union all
        -- Atividade sem dono: de topo, aberta, de fase de obra, com fim previsto
        -- gravado pelo app e sem tarefa vinculada aberta (a tarefa a representa).
        select null::uuid, null::text, oa.fim_previsto_calc
        from public.obra_atividade oa
        join public.obra o on o.id = oa.obra_id and o.status = 'ativa' and o.deleted_at is null and o.ambiente = 'contorno'
        join public.obra_fase f on f.id = oa.fase_id
        where oa.pai_id is null and oa.concluida_em is null and oa.deleted_at is null
          and oa.fim_previsto_calc is not null
          and not exists (
            select 1 from public.tarefa t
            where t.vinculo_tipo = 'atividade' and t.vinculo_id = oa.id
              and t.status = 'aberta' and t.deleted_at is null
          )
      ),
      -- Linha por pessoa (resumoEquipeDia): pessoa do app, nome digitado ou sem.
      linhas as (
        select
          case when a.pessoa_id is not null then a.pessoa_id::text
               when a.nome_digitado is not null then 'nome:' || a.nome_digitado
               else 'sem' end as chave,
          a.pessoa_id,
          coalesce(p.nome, a.nome_digitado, 'Sem responsável') as nome,
          (count(*) filter (where a.prazo < v_hoje))::int as atrasadas,
          (count(*) filter (where a.prazo = v_hoje))::int as hoje
        from acoes a
        left join public.pessoa p on p.id = a.pessoa_id
        where a.prazo <= v_hoje
        group by 1, 2, 3
      ),
      tot as (
        select coalesce(sum(atrasadas), 0)::int as atrasadas, coalesce(sum(hoje), 0)::int as hoje
        from linhas
      ),
      equipe as (
        select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'atrasadas', atrasadas, 'hoje', hoje)
                                  order by atrasadas desc, hoje desc, nome), '[]'::jsonb) as pessoas
        from linhas where chave <> 'sem'
      )
      select 'acoes', v_hoje, p.user_id, 'CONTRO · Ações de hoje',
        public.contro_totais_acoes(l.atrasadas, l.hoje) || '. Toque para ver a lista.',
        '/?ir=minhas'
      from linhas l
      join public.pessoa p on p.id = l.pessoa_id
      where p.ativo and p.deleted_at is null and p.acesso_contorno and p.user_id is not null and p.perfil <> 'gestor'
        and l.atrasadas + l.hoje > 0
      union all
      select 'acoes_equipe', v_hoje, g.user_id, 'CONTRO · Equipe hoje',
        public.contro_texto_equipe(tot.atrasadas, tot.hoje, equipe.pessoas),
        '/?ir=tarefas'
      from public.pessoa g cross join tot cross join equipe
      where g.ativo and g.deleted_at is null and g.acesso_contorno and g.user_id is not null and g.perfil = 'gestor'
        and tot.atrasadas + tot.hoje > 0
      on conflict (tipo, dia, user_id) where tipo <> 'atribuicao' do nothing;
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end if;

    if c.provid_ativo and v_hora >= c.provid_hora and v_hora < c.provid_hora + interval '3 hours' then
      insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
      select 'providencias', v_hoje, p.user_id, 'CONTRO · Providências',
        'Confira o que contratar, alugar ou comprar a partir de hoje.',
        '/?ir=hoje'
      from public.pessoa p
      where p.ativo and p.deleted_at is null and p.acesso_contorno and p.user_id is not null
        and (c.provid_para = 'todos' or p.perfil = 'gestor')
      on conflict (tipo, dia, user_id) where tipo <> 'atribuicao' do nothing;
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end if;
  end if;

  return v_n;
end;
$$;

create or replace function gerar_avisos_gerais(p_agora timestamptz default now())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date := (p_agora at time zone 'America/Sao_Paulo')::date;
  v_hora time := (p_agora at time zone 'America/Sao_Paulo')::time;
  v_dow int := extract(isodow from (p_agora at time zone 'America/Sao_Paulo'));
  v_n int := 0;
  v_k int;
begin
  if not exists (select 1 from public.config_avisos where id) then return 0; end if;

  -- Lembretes da reunião, de manhã.
  insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
  with cfg as (
    select o.nome, k.*
    from public.obra o
    cross join lateral public.contro_config_avisos_obra(o.id) k
    where o.ambiente = 'geral' and o.status = 'ativa' and o.deleted_at is null
  ),
  reunioes as (
    select obra_id, nome, reuniao_hora,
      (v_hora >= manha_hora and v_hora < manha_hora + interval '3 hours') as agora
    from cfg
    where reuniao_dia = v_dow and manha_ativo and manha_hora < reuniao_hora
  ),
  destinos as (
    select p.user_id, r.*
    from reunioes r
    join public.pessoa p on p.ativo and p.deleted_at is null and p.user_id is not null
      and (p.administrador or exists (
        select 1 from public.obra_participante op
        where op.obra_id = r.obra_id and op.pessoa_id = p.id))
  ),
  por_pessoa as (
    select user_id, count(*)::int as n,
      string_agg(nome || ' ' || to_char(reuniao_hora, 'HH24:MI'), ' · ' order by reuniao_hora, nome) as lista,
      (array_agg(obra_id order by reuniao_hora, nome))[1] as obra_id,
      (array_agg(nome order by reuniao_hora, nome))[1] as nome,
      (array_agg(reuniao_hora order by reuniao_hora, nome))[1] as reuniao_hora
    from destinos
    group by user_id
    having bool_or(agora)
  )
  select 'reuniao_manha_geral', v_hoje, user_id, 'CONTRO · Reunião',
    case when n = 1 then 'Reunião hoje às ' || to_char(reuniao_hora, 'HH24:MI') || ' · ' || nome
         else 'Reuniões hoje: ' || lista end,
    '/?ir=geral-reuniao&obra=' || obra_id
  from por_pessoa
  on conflict (tipo, dia, user_id) where tipo <> 'atribuicao' do nothing;
  get diagnostics v_k = row_count; v_n := v_n + v_k;

  -- Lembretes da reunião, antes de começar.
  insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
  with cfg as (
    select o.nome, k.*
    from public.obra o
    cross join lateral public.contro_config_avisos_obra(o.id) k
    where o.ambiente = 'geral' and o.status = 'ativa' and o.deleted_at is null
  ),
  janela as (
    select obra_id, nome, reuniao_hora, antes_min
    from cfg
    where reuniao_dia = v_dow and antes_ativo
      and v_hora >= reuniao_hora - make_interval(mins => antes_min) and v_hora < reuniao_hora
  )
  select distinct on (p.user_id) 'reuniao_antes_geral', v_hoje, p.user_id, 'CONTRO · Reunião',
    'Começa em ' || case j.antes_min when 30 then '30 min' when 60 then '1 hora' else '2 horas' end
      || ' · ' || j.nome,
    '/?ir=geral-reuniao&obra=' || j.obra_id
  from janela j
  join public.pessoa p on p.ativo and p.deleted_at is null and p.user_id is not null
    and (p.administrador or exists (
      select 1 from public.obra_participante op
      where op.obra_id = j.obra_id and op.pessoa_id = p.id))
  order by p.user_id, j.reuniao_hora, j.nome
  on conflict (tipo, dia, user_id) where tipo <> 'atribuicao' do nothing;
  get diagnostics v_k = row_count; v_n := v_n + v_k;

  -- Ações do dia: segunda a sexta.
  if v_dow not between 1 and 5 then return v_n; end if;

  insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
  with cfg as (
    select k.obra_id, k.pend_alta_du, k.pend_media_du, k.pend_baixa_du,
      (v_hora >= k.acoes_hora and v_hora < k.acoes_hora + interval '3 hours') as agora
    from public.obra o
    cross join lateral public.contro_config_avisos_obra(o.id) k
    where o.ambiente = 'geral' and o.status = 'ativa' and o.deleted_at is null and k.acoes_ativo
  ),
  acoes as (
    -- Atividade de topo aberta; com tarefa vinculada aberta, conta a tarefa.
    select oa.obra_id, oa.responsavel_id as pessoa_id,
      public.contro_prazo_atividade_geral(oa.id, oa.data_prevista) as prazo
    from public.obra_atividade oa
    join cfg on cfg.obra_id = oa.obra_id
    where oa.pai_id is null and oa.concluida_em is null and oa.deleted_at is null
      and not exists (
        select 1 from public.tarefa t
        where t.vinculo_tipo = 'atividade' and t.vinculo_id = oa.id
          and t.status = 'aberta' and t.deleted_at is null
      )
    union all
    select t.obra_id, t.responsavel_id, t.prazo
    from public.tarefa t
    join cfg on cfg.obra_id = t.obra_id
    where t.status = 'aberta' and t.deleted_at is null
    union all
    select pe.obra_id, pe.responsavel_id,
      coalesce(pe.prazo, public.contro_prazo_pendencia_du(pe.criticidade, pe.apontada_em,
        cfg.pend_alta_du, cfg.pend_media_du, cfg.pend_baixa_du))
    from public.pendencia pe
    join cfg on cfg.obra_id = pe.obra_id
    where pe.status = 'aberta' and pe.deleted_at is null
    union all
    -- Providência pendente com prazo, atividade aberta e sem tarefa vinculada
    -- aberta (a tarefa a representa); dona = responsável da atividade de topo.
    select op.obra_id, topo.responsavel_id, op.providenciar_ate
    from public.obra_providencia op
    join cfg on cfg.obra_id = op.obra_id
    join public.obra_atividade oa on oa.id = op.atividade_id
      and oa.concluida_em is null and oa.deleted_at is null
    join public.obra_atividade topo on topo.id = coalesce(oa.pai_id, oa.id)
    where op.status = 'pendente' and op.deleted_at is null and op.providenciar_ate is not null
      and not exists (
        select 1 from public.tarefa t
        where t.vinculo_tipo = 'providencia' and t.vinculo_id = op.id
          and t.status = 'aberta' and t.deleted_at is null
      )
  ),
  -- Atrasadas ou de hoje, com a janela da obra (agora).
  devidas as (
    select a.obra_id, a.pessoa_id, a.prazo, cfg.agora
    from acoes a
    join cfg on cfg.obra_id = a.obra_id
    where a.prazo <= v_hoje
  ),
  -- Por responsável, de todas as obras gerais que ele vê: participa da obra
  -- ou é Administrador (defesa: a saída da obra já tira o responsável).
  minhas as (
    select a.pessoa_id,
      (count(*) filter (where a.prazo < v_hoje))::int as atrasadas,
      (count(*) filter (where a.prazo = v_hoje))::int as hoje
    from devidas a
    join public.pessoa pv on pv.id = a.pessoa_id
    where pv.administrador or exists (
      select 1 from public.obra_participante op
      where op.obra_id = a.obra_id and op.pessoa_id = a.pessoa_id)
    group by a.pessoa_id
    having bool_or(a.agora)
  ),
  -- Quem recebe o da equipe e as obras que vê (sem repetir a obra).
  leitores as (
    select p.user_id, o.id as obra_id
    from public.pessoa p
    join public.obra o on o.ambiente = 'geral' and o.status = 'ativa' and o.deleted_at is null
    where p.administrador and p.ativo and p.deleted_at is null and p.user_id is not null
    union
    select p.user_id, op.obra_id
    from public.pessoa p
    join public.obra_participante op on op.pessoa_id = p.id
    where p.papel_geral = 'coordenador' and p.ativo and p.deleted_at is null and p.user_id is not null
  ),
  -- Linha por leitor e pessoa (resumoEquipeDia); pessoa_id nulo = Sem responsável.
  linhas as (
    select l.user_id, a.pessoa_id,
      coalesce(pr.nome, 'Sem responsável') as nome,
      (count(*) filter (where a.prazo < v_hoje))::int as atrasadas,
      (count(*) filter (where a.prazo = v_hoje))::int as hoje,
      bool_or(a.agora) as agora
    from leitores l
    join devidas a on a.obra_id = l.obra_id
    left join public.pessoa pr on pr.id = a.pessoa_id
    group by l.user_id, a.pessoa_id, pr.nome
  ),
  equipe as (
    select user_id,
      sum(atrasadas)::int as atrasadas,
      sum(hoje)::int as hoje,
      coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'atrasadas', atrasadas, 'hoje', hoje)
                         order by atrasadas desc, hoje desc, nome)
               filter (where pessoa_id is not null), '[]'::jsonb) as pessoas
    from linhas
    group by user_id
    having bool_or(agora)
  )
  select 'acoes_geral', v_hoje, p.user_id, 'CONTRO · Obras gerais',
    public.contro_totais_acoes(m.atrasadas, m.hoje) || '. Toque para ver a lista.',
    '/?ir=geral-hoje'
  from minhas m
  join public.pessoa p on p.id = m.pessoa_id
  where p.ativo and p.deleted_at is null and p.user_id is not null
    and m.atrasadas + m.hoje > 0
  union all
  select 'equipe_geral', v_hoje, e.user_id, 'CONTRO · Obras gerais · equipe',
    public.contro_texto_equipe(e.atrasadas, e.hoje, e.pessoas),
    '/?ir=geral-hoje'
  from equipe e
  where e.atrasadas + e.hoje > 0
  on conflict (tipo, dia, user_id) where tipo <> 'atribuicao' do nothing;
  get diagnostics v_k = row_count; v_n := v_n + v_k;
  return v_n;
end;
$$;
