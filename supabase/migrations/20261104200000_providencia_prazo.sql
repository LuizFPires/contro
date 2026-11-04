-- Providências como ações (04/11/2026): a providência pendente sem tarefa
-- vinculada aberta é uma ação "Sem responsável" com prazo = data limite para
-- providenciar (providenciarAte do core, a partir do cronograma). O cronograma
-- só existe no cliente (packages/core), então o app grava o prazo calculado em
-- obra_providencia.providenciar_ate pela RPC atualizar_prazos_providencias
-- sempre que recalcula a obra, e o gerar_avisos o lê para contar essas
-- providências no aviso "Equipe hoje" do gestor (packages/core/src/acoes.ts,
-- providenciaParaAcaoBase). Mudou a regra lá? Mude aqui.
--
-- Sem backfill: a coluna nasce nula e é preenchida conforme o app abre as
-- obras. Pode ficar defasada até alguém abrir o app depois de mudar o
-- cronograma; providências com providenciar_ate nulo não entram no aviso.

-- 1. Coluna derivada (só o app grava, pela RPC).
alter table public.obra_providencia add column providenciar_ate date;

-- 2. Grava em lote os prazos calculados; só escreve o que mudou (idempotente).
-- p_prazos = [{"id": "<uuid>", "ate": "YYYY-MM-DD"}]. Devolve as linhas alteradas.
create or replace function public.atualizar_prazos_providencias(p_obra_id uuid, p_prazos jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not exists (select 1 from public.obra where id = p_obra_id and deleted_at is null) then
    raise exception 'Obra não encontrada' using errcode = '23503';
  end if;
  update public.obra_providencia op
     set providenciar_ate = x.ate
    from jsonb_to_recordset(coalesce(p_prazos, '[]'::jsonb)) as x(id uuid, ate date)
   where op.id = x.id
     and op.obra_id = p_obra_id
     and op.providenciar_ate is distinct from x.ate;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.atualizar_prazos_providencias(uuid, jsonb) from public, anon;
grant execute on function public.atualizar_prazos_providencias(uuid, jsonb) to authenticated;

-- 3. gerar_avisos: igual ao de 20261104100000_acoes_do_dia, com a CTE acoes
-- ganhando as providências sem dono (chave 'sem': só nos totais do gestor).
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
  select count(*) into v_obras from public.obra where status = 'ativa' and deleted_at is null;

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
      where p.ativo and p.deleted_at is null and p.user_id is not null
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
      where p.ativo and p.deleted_at is null and p.user_id is not null
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
        join public.obra o on o.id = t.obra_id and o.status = 'ativa' and o.deleted_at is null
        where t.status = 'aberta' and t.deleted_at is null
        union all
        select pe.responsavel_id, null::text,
          public.contro_prazo_pendencia(pe.criticidade, pe.apontada_em, c)
        from public.pendencia pe
        join public.obra o on o.id = pe.obra_id and o.status = 'ativa' and o.deleted_at is null
        where pe.status = 'aberta' and pe.deleted_at is null
        union all
        -- Providência sem dono: pendente, com prazo gravado pelo app, atividade
        -- aberta e sem tarefa vinculada aberta (a tarefa a representa).
        select null::uuid, null::text, op.providenciar_ate
        from public.obra_providencia op
        join public.obra o on o.id = op.obra_id and o.status = 'ativa' and o.deleted_at is null
        join public.obra_atividade oa on oa.id = op.atividade_id
          and oa.concluida_em is null and oa.deleted_at is null
        where op.status = 'pendente' and op.deleted_at is null and op.providenciar_ate is not null
          and not exists (
            select 1 from public.tarefa t
            where t.vinculo_tipo = 'providencia' and t.vinculo_id = op.id
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
      where p.ativo and p.deleted_at is null and p.user_id is not null and p.perfil <> 'gestor'
        and l.atrasadas + l.hoje > 0
      union all
      select 'acoes_equipe', v_hoje, g.user_id, 'CONTRO · Equipe hoje',
        public.contro_texto_equipe(tot.atrasadas, tot.hoje, equipe.pessoas),
        '/?ir=tarefas'
      from public.pessoa g cross join tot cross join equipe
      where g.ativo and g.deleted_at is null and g.user_id is not null and g.perfil = 'gestor'
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
      where p.ativo and p.deleted_at is null and p.user_id is not null
        and (c.provid_para = 'todos' or p.perfil = 'gestor')
      on conflict (tipo, dia, user_id) where tipo <> 'atribuicao' do nothing;
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end if;
  end if;

  return v_n;
end;
$$;

revoke execute on function gerar_avisos(timestamptz) from public, anon, authenticated;
