-- Ações do dia (04/11/2026): tarefas e pendências do check list viram "ação" com
-- prazo. A pendência vence em dias úteis pela criticidade (alta 2, média 4,
-- baixa 6, configuráveis), contados do dia útil em que foi apontada (fuso de
-- São Paulo). Os avisos "resumo" (Bom dia) e "tarefas" dão lugar a dois:
--   acoes        → cada pessoa da equipe com login: as suas atrasadas e de hoje;
--   acoes_equipe → cada gestor: totais da equipe e até 3 pessoas.
-- Os textos espelham, caractere a caractere, packages/core/src/acoes.ts
-- (textoAvisoAcoes, textoAvisoEquipe, resumoEquipeDia) e nomeCurto de
-- packages/core/src/nomes.ts. Mudou lá? Mude aqui.

-- 1. Configuração: um horário só para as ações e os prazos da pendência.
alter table public.config_avisos
  add column acoes_ativo boolean not null default true,
  add column acoes_hora time not null default '07:30',
  add column pend_alta_du smallint not null default 2 check (pend_alta_du between 1 and 30),
  add column pend_media_du smallint not null default 4 check (pend_media_du between 1 and 30),
  add column pend_baixa_du smallint not null default 6 check (pend_baixa_du between 1 and 30);
update public.config_avisos set
  acoes_ativo = resumo_ativo or tarefas_ativo,
  -- Só o aviso de tarefas estava ligado: vale o horário dele.
  acoes_hora = case when resumo_ativo then resumo_hora else tarefas_hora end;
alter table public.config_avisos
  drop column resumo_ativo,
  drop column resumo_hora,
  drop column resumo_para,
  drop column tarefas_ativo,
  drop column tarefas_hora;

-- 2. Tipos de aviso: saem resumo e tarefas (o índice diário parcial continua
-- valendo para todos os tipos menos atribuicao).
delete from public.aviso_disparo where tipo in ('resumo', 'tarefas');
alter table public.aviso_disparo drop constraint aviso_disparo_tipo_check;
alter table public.aviso_disparo add constraint aviso_disparo_tipo_check
  check (tipo in ('reuniao_manha','reuniao_antes','acoes','acoes_equipe','providencias','atribuicao'));

-- 3. Dias úteis (seg–sex, sem feriados). Base em sáb/dom vai para a segunda
-- antes de contar (diaUtilAPartir + addDU do core).
create or replace function public.contro_add_du(d date, n int)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v date := d;
  k int := 0;
begin
  while extract(isodow from v) > 5 loop v := v + 1; end loop;
  if n is null or n <= 0 then return v; end if;
  while k < n loop
    v := v + 1;
    if extract(isodow from v) <= 5 then k := k + 1; end if;
  end loop;
  return v;
end;
$$;

-- Prazo da pendência (prazoPendencia do core): dia local de São Paulo.
create or replace function public.contro_prazo_pendencia(
  criticidade text, apontada_em timestamptz, c public.config_avisos
)
returns date
language sql
stable
set search_path = ''
as $$
  select public.contro_add_du(
    (apontada_em at time zone 'America/Sao_Paulo')::date,
    case criticidade when 'alta' then c.pend_alta_du
                     when 'media' then c.pend_media_du
                     else c.pend_baixa_du end
  );
$$;

-- nomeCurto: primeiro nome + inicial do primeiro sobrenome que não é partícula.
create or replace function public.contro_nome_curto(p_nome text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  partes text[];
begin
  partes := regexp_split_to_array(regexp_replace(coalesce(p_nome, ''), '^\s+|\s+$', '', 'g'), '\s+');
  if array_length(partes, 1) is null or partes[1] = '' then return ''; end if;
  for i in 2 .. coalesce(array_length(partes, 1), 1) loop
    if lower(partes[i]) not in ('da', 'das', 'de', 'do', 'dos', 'e') then
      return partes[1] || ' ' || upper(left(partes[i], 1));
    end if;
  end loop;
  return partes[1];
end;
$$;

-- "3 atrasadas e 4 vencem hoje"; omite a parte zerada (totais do core).
create or replace function public.contro_totais_acoes(p_atrasadas int, p_hoje int)
returns text
language sql
immutable
set search_path = ''
as $$
  select concat_ws(' e ',
    case when p_atrasadas = 1 then '1 atrasada'
         when p_atrasadas > 1 then p_atrasadas || ' atrasadas' end,
    case when p_hoje = 1 then '1 vence hoje'
         when p_hoje > 1 then p_hoje || ' vencem hoje' end);
$$;

-- textoAvisoEquipe: p_pessoas já ordenado (atrasadas desc, hoje desc, nome) e
-- sem "Sem responsável" (que só entra nos totais). Até 3 pessoas; acima de 120
-- caracteres tira a última listada e recalcula "e mais N".
create or replace function public.contro_texto_equipe(p_atrasadas int, p_hoje int, p_pessoas jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_tot text;
  v_total int := coalesce(jsonb_array_length(p_pessoas), 0);
  v_lista text;
  v_resto int;
  v_corpo text;
begin
  if coalesce(p_atrasadas, 0) = 0 and coalesce(p_hoje, 0) = 0 then return null; end if;
  v_tot := public.contro_totais_acoes(p_atrasadas, p_hoje);
  for n in reverse least(3, v_total) .. 1 loop
    select string_agg(public.contro_nome_curto(e ->> 'nome') || ' ' || (e ->> 'atrasadas') || '+' || (e ->> 'hoje'),
                      ', ' order by i)
      into v_lista
      from jsonb_array_elements(p_pessoas) with ordinality as t(e, i)
      where i <= n;
    v_resto := v_total - n;
    v_corpo := v_tot || ' · ' || v_lista
      || case when v_resto > 0 then ' e mais ' || v_resto else '' end || '.';
    if char_length(v_corpo) <= 120 then return v_corpo; end if;
  end loop;
  v_corpo := v_tot || '.';
  if char_length(v_corpo) <= 120 then return v_corpo; end if;
  return left(v_corpo, 119) || '…';
end;
$$;

revoke execute on function public.contro_add_du(date, int) from public, anon, authenticated;
revoke execute on function public.contro_prazo_pendencia(text, timestamptz, public.config_avisos) from public, anon, authenticated;
revoke execute on function public.contro_nome_curto(text) from public, anon, authenticated;
revoke execute on function public.contro_totais_acoes(int, int) from public, anon, authenticated;
revoke execute on function public.contro_texto_equipe(int, int, jsonb) from public, anon, authenticated;

-- 4. gerar_avisos: reunião e providências como antes; resumo e tarefas viram ações.
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
