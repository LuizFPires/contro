-- Obras gerais · Etapa 3: avisos por push das obras gerais. Nada disso toca a
-- Contorno: o gerar_avisos e o cron avisos-gerar ficam como estão.
--   Na hora (tipo atribuicao, enviado pelo gatilho aviso_atribuicao_imediata):
--     atividade atribuída, data mudada (replanejamento, também pelo subitem)
--     e "saiu da obra"; o Desfazer da troca de responsável
--     (desfazer_responsavel_atividade) não avisa.
--   Do dia (gerar_avisos_gerais, cron avisos-gerais): acoes_geral por pessoa e
--     equipe_geral para Coordenadores e Administradores.
-- Horários: os de config_avisos (acoes_ativo, acoes_hora) até a etapa 4 trazer
-- a configuração por obra. Todos abrem o Hoje de Obras gerais (/?ir=geral-hoje).
-- Textos: os do plano da etapa 3 (Global Constraints); os do dia reaproveitam
-- contro_totais_acoes e contro_texto_equipe, que espelham textoAvisoAcoes e
-- textoAvisoEquipe de packages/core/src/acoes.ts.

-- 1) Tipos de aviso: acoes_geral e equipe_geral a mais. O índice diário
-- parcial (tipo, dia, user_id) where tipo <> 'atribuicao' vale para os dois.
alter table public.aviso_disparo drop constraint aviso_disparo_tipo_check;
alter table public.aviso_disparo add constraint aviso_disparo_tipo_check
  check (tipo in ('reuniao_manha','reuniao_antes','acoes','acoes_equipe','providencias','atribuicao',
                  'acoes_geral','equipe_geral'));

-- 2) Prazo da atividade geral (espelha prazoAtividadeGeral de
-- packages/core/src/obraGeral.ts): o último subitem não excluído com data;
-- sem subitem com data, a data prevista da própria atividade.
create or replace function public.contro_prazo_atividade_geral(p_atividade_id uuid, p_data_prevista date)
returns date
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select max(s.data_prevista) from public.obra_atividade s
     where s.pai_id = p_atividade_id and s.deleted_at is null and s.data_prevista is not null),
    p_data_prevista);
$$;
revoke execute on function public.contro_prazo_atividade_geral(uuid, date) from public, anon, authenticated;

-- 3) Atividade atribuída e data mudada, na hora. Só obra geral; o responsável
-- é da atividade de topo (subitem não tem responsável), que precisa estar não
-- excluída e aberta. Nunca avisa quem fez a mudança (pessoa do auth.uid(); sem
-- login, avisa normalmente). Só avisa quem participa da obra ou é
-- Administrador ativo (defesa em profundidade: as RPCs já validam o responsável).
--   Atribuição (atividade de topo): novo responsável não nulo e diferente do
--     anterior (inclui criar já com responsável). "até" = prazo da atividade
--     (regra do último subitem); sem prazo, sem o trecho " · até". Ao criar
--     pelo adicionar_atividade_geral os subitens entram depois da atividade: o
--     "até" usa a data dela. O Desfazer da troca (desfazer_responsavel_atividade)
--     liga contro.desfazer na transação e não avisa.
--   Nova data: replanejamento (a data mudou de uma data para outra) na
--     atividade de topo ou num subitem dela que muda o prazo efetivo da
--     atividade de topo (contro_prazo_atividade_geral). Avisa o responsável da
--     atividade de topo, com o nome dela e o prazo efetivo antigo → novo. Prazo
--     efetivo igual (ex.: data da atividade editada enquanto os subitens
--     mandam): não avisa. O Desfazer (desfazer_data_prevista) volta o contador
--     de replanejamentos; quando ele diminui, é Desfazer e não avisa.
create or replace function public.contro_avisa_atividade_geral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra text;
  v_por uuid;
  v_user uuid;
  v_prazo date;
  v_topo public.obra_atividade%rowtype;
  v_prazo_antigo date;
  v_prazo_novo date;
begin
  if new.deleted_at is not null or new.concluida_em is not null then
    return new;
  end if;
  select o.nome into v_obra from public.obra o
  where o.id = new.obra_id and o.ambiente = 'geral' and o.deleted_at is null;
  if not found then
    return new;
  end if;
  select id into v_por from public.pessoa where user_id = auth.uid() and deleted_at is null;

  if new.pai_id is null
     and new.responsavel_id is not null
     and (tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id)
     and new.responsavel_id is distinct from v_por
     and coalesce(current_setting('contro.desfazer', true), '') <> '1' then
    select user_id into v_user from public.pessoa p
    where p.id = new.responsavel_id and p.ativo and p.deleted_at is null
      and (p.administrador or exists (
        select 1 from public.obra_participante op
        where op.obra_id = new.obra_id and op.pessoa_id = p.id));
    if v_user is not null then
      v_prazo := public.contro_prazo_atividade_geral(new.id, new.data_prevista);
      insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
      values ('atribuicao', (now() at time zone 'America/Sao_Paulo')::date, v_user,
        'CONTRO · ' || v_obra,
        'Nova atividade para você: ' || new.nome
          || coalesce(' · até ' || to_char(v_prazo, 'DD/MM'), ''),
        '/?ir=geral-hoje');
    end if;
    -- Atribuiu agora: o aviso de atribuição já leva o prazo.
    return new;
  end if;

  if tg_op <> 'UPDATE'
     or old.data_prevista is null or new.data_prevista is null
     or new.data_prevista = old.data_prevista
     or new.replanejamentos < old.replanejamentos then
    return new;
  end if;

  -- Prazo efetivo da atividade de topo antes e depois. O gatilho é after: a
  -- linha já tem a data nova, e a antiga entra no lugar dela.
  if new.pai_id is null then
    v_topo := new;
    v_prazo_antigo := public.contro_prazo_atividade_geral(new.id, old.data_prevista);
  else
    select * into v_topo from public.obra_atividade
    where id = new.pai_id and pai_id is null and deleted_at is null and concluida_em is null;
    if not found then
      return new;
    end if;
    select coalesce(max(x.d), v_topo.data_prevista) into v_prazo_antigo
    from (
      select s.data_prevista as d from public.obra_atividade s
      where s.pai_id = v_topo.id and s.deleted_at is null and s.id <> new.id
      union all
      select old.data_prevista
    ) x;
  end if;
  v_prazo_novo := public.contro_prazo_atividade_geral(v_topo.id, v_topo.data_prevista);
  if v_prazo_antigo is null or v_prazo_novo is null or v_prazo_novo = v_prazo_antigo
     or v_topo.responsavel_id is null
     or v_topo.responsavel_id is not distinct from v_por then
    return new;
  end if;
  select user_id into v_user from public.pessoa p
  where p.id = v_topo.responsavel_id and p.ativo and p.deleted_at is null
    and (p.administrador or exists (
      select 1 from public.obra_participante op
      where op.obra_id = v_topo.obra_id and op.pessoa_id = p.id));
  if v_user is not null then
    insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
    values ('atribuicao', (now() at time zone 'America/Sao_Paulo')::date, v_user,
      'CONTRO · ' || v_obra,
      'Nova data: ' || v_topo.nome || ' · ' || to_char(v_prazo_antigo, 'DD/MM')
        || ' → ' || to_char(v_prazo_novo, 'DD/MM'),
      '/?ir=geral-hoje');
  end if;
  return new;
end;
$$;
revoke execute on function public.contro_avisa_atividade_geral() from public, anon, authenticated;
create trigger obra_atividade_avisa_geral
  after insert or update of responsavel_id, data_prevista on public.obra_atividade
  for each row execute function public.contro_avisa_atividade_geral();

-- Desfazer da troca de responsável (toast de 5 s): as mesmas regras do
-- definir_responsavel_atividade (só quem planeja; responsável ativo que
-- participa da obra ou Administrador), mas liga contro.desfazer só durante o
-- update, para o gatilho não mandar "Nova atividade" a quem só volta a ser o
-- responsável. Evento `responsavel` com depois {responsavel_id, desfeito: true}.
create or replace function desfazer_responsavel_atividade(p_atividade_id uuid, p_responsavel_id uuid)
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
  perform set_config('contro.desfazer', '1', true);
  update public.obra_atividade set responsavel_id = p_responsavel_id where id = p_atividade_id;
  perform set_config('contro.desfazer', '', true);
  insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
  values (p_atividade_id, 'responsavel', v_pessoa,
    jsonb_build_object('responsavel_id', v_antigo),
    jsonb_build_object('responsavel_id', p_responsavel_id, 'desfeito', true));
end;
$$;
revoke execute on function desfazer_responsavel_atividade(uuid, uuid) from public, anon;
grant execute on function desfazer_responsavel_atividade(uuid, uuid) to authenticated;

-- 4) Saída da obra (etapa 2, 20261106120000): corpo copiado e, quando n > 0
-- atividades abertas ficaram sem responsável, avisa cada Coordenador que
-- participa da obra e cada Administrador ativo, menos quem fez a ação e quem
-- saiu. "1 atividade ficou" / "n atividades ficaram".
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

-- 5) Avisos do dia das obras gerais. Seg a sex, com acoes_ativo e na janela de
-- 3 h depois de acoes_hora (a mesma regra do gerar_avisos). Ação = atividade de
-- topo aberta, não excluída, de obra geral ativa, com prazo (regra do último
-- subitem) até hoje: atrasada (prazo < hoje) ou de hoje. Sem data: fora.
--   acoes_geral  → cada responsável ativo com login: as suas, de todas as obras.
--   equipe_geral → cada Coordenador (nas obras de que participa) e cada
--                  Administrador ativo (todas): totais e até 3 pessoas, na ordem
--                  do gerar_avisos; "Sem responsável" só nos totais.
create or replace function gerar_avisos_gerais(p_agora timestamptz default now())
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
  v_n int := 0;
begin
  select * into c from public.config_avisos where id;
  if not found then return 0; end if;
  if v_dow not between 1 and 5 then return 0; end if;
  if not (c.acoes_ativo and v_hora >= c.acoes_hora and v_hora < c.acoes_hora + interval '3 hours') then
    return 0;
  end if;

  insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
  with acoes as (
    select a.obra_id, a.pessoa_id, a.prazo
    from (
      select oa.obra_id, oa.responsavel_id as pessoa_id,
        public.contro_prazo_atividade_geral(oa.id, oa.data_prevista) as prazo
      from public.obra_atividade oa
      join public.obra o on o.id = oa.obra_id and o.status = 'ativa' and o.deleted_at is null and o.ambiente = 'geral'
      where oa.pai_id is null and oa.concluida_em is null and oa.deleted_at is null
    ) a
    where a.prazo <= v_hoje
  ),
  -- Por responsável, de todas as obras gerais.
  minhas as (
    select a.pessoa_id,
      (count(*) filter (where a.prazo < v_hoje))::int as atrasadas,
      (count(*) filter (where a.prazo = v_hoje))::int as hoje
    from acoes a
    where a.pessoa_id is not null
    group by a.pessoa_id
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
      (count(*) filter (where a.prazo = v_hoje))::int as hoje
    from leitores l
    join acoes a on a.obra_id = l.obra_id
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
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function gerar_avisos_gerais(timestamptz) from public, anon, authenticated;

-- 6) Cron próprio, a cada 5 min (o avisos-gerar da Contorno fica como está).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'avisos-gerais') then
      perform cron.unschedule('avisos-gerais');
    end if;
    perform cron.schedule('avisos-gerais', '*/5 * * * *', 'select public.gerar_avisos_gerais();');
  end if;
end $$;
