-- Obras gerais · Etapa 4: "Reunião e avisos" por obra geral, providências com
-- prazo gravado pelo banco e ações do dia completas (decisões 5 e 7).
-- Nada disso toca a Contorno: config_avisos, contro_prazo_pendencia,
-- gerar_avisos, abrir_reuniao e atualizar_prazos_providencias ficam como estão.
--   config_avisos_obra: mesmas colunas e CHECKs da config_avisos (sem
--     provid_para); sem linha = valores da linha global. Lê quem vê a obra;
--     grava só salvar_config_avisos_obra (quem planeja a obra geral).
--   obra_providencia.providenciar_ate da obra geral: gatilhos (a providência
--     muda; a data da atividade ou de um subitem dela muda), espelhando
--     providenciarAteGeral de packages/core/src/obraGeralSemana.ts.
--   gerar_avisos_gerais: ações = atividades + tarefas + pendências +
--     providências; horário e ativo por obra; lembretes de reunião por obra
--     (reuniao_manha_geral, reuniao_antes_geral).
--   abrir_reuniao_geral: a hora vem da config da obra (contro_config_avisos_obra).
-- Origem das cópias:
--   gerar_avisos_gerais   20261106200000_obras_gerais_avisos.sql §5
--   abrir_reuniao_geral   20261106300000_obras_gerais_reuniao.sql §4

-- 1) Configuração por obra geral -------------------------------------------

create table config_avisos_obra (
  obra_id uuid primary key references obra (id) on delete cascade,
  reuniao_dia smallint not null check (reuniao_dia between 1 and 5),
  reuniao_hora time not null,
  manha_ativo boolean not null,
  manha_hora time not null,
  antes_ativo boolean not null,
  antes_min smallint not null check (antes_min in (30, 60, 120)),
  acoes_ativo boolean not null,
  acoes_hora time not null,
  pend_alta_du smallint not null check (pend_alta_du between 1 and 30),
  pend_media_du smallint not null check (pend_media_du between 1 and 30),
  pend_baixa_du smallint not null check (pend_baixa_du between 1 and 30),
  provid_ativo boolean not null,
  provid_hora time not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references pessoa (id)
);
create trigger config_avisos_obra_set_updated_at before update on config_avisos_obra
  for each row execute function set_updated_at();

alter table config_avisos_obra enable row level security;
-- Lê quem vê a obra; sem insert/update/delete pela app (só pela RPC).
create policy config_avisos_obra_sel on config_avisos_obra for select to authenticated
  using (contro_ve_obra(obra_id));

-- Config efetiva (interna): a linha da obra ou, sem ela, os valores da global
-- (updated_at/updated_by nulos). Sem a linha global, tudo nulo.
create or replace function public.contro_config_avisos_obra(p_obra_id uuid)
returns public.config_avisos_obra
language plpgsql
stable
security definer
set search_path = ''
as $$
declare r public.config_avisos_obra;
begin
  select * into r from public.config_avisos_obra where obra_id = p_obra_id;
  if found then return r; end if;
  select p_obra_id, c.reuniao_dia, c.reuniao_hora, c.manha_ativo, c.manha_hora,
         c.antes_ativo, c.antes_min, c.acoes_ativo, c.acoes_hora,
         c.pend_alta_du, c.pend_media_du, c.pend_baixa_du,
         c.provid_ativo, c.provid_hora, null::timestamptz, null::uuid
    into r
    from public.config_avisos c where c.id;
  return r;
end;
$$;
revoke execute on function public.contro_config_avisos_obra(uuid) from public, anon, authenticated;

-- Leitura efetiva para a tela "Reunião e avisos" da obra: as colunas da
-- config (horas como "16:00:00") e personalizada = a obra tem linha própria.
create or replace function config_avisos_da_obra(p_obra_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_ambiente text;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select ambiente into v_ambiente from public.obra where id = p_obra_id and deleted_at is null;
  if v_ambiente is null then
    raise exception 'Obra inválida' using errcode = '23503';
  end if;
  if v_ambiente <> 'geral' then
    raise exception 'Obra da Contorno: use config_avisos' using errcode = '23505';
  end if;
  if not public.contro_ve_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  return (to_jsonb(public.contro_config_avisos_obra(p_obra_id)) - 'updated_at' - 'updated_by')
    || jsonb_build_object('personalizada',
         exists (select 1 from public.config_avisos_obra where obra_id = p_obra_id));
end;
$$;
revoke execute on function config_avisos_da_obra(uuid) from public, anon;
grant execute on function config_avisos_da_obra(uuid) to authenticated;

-- Grava a config da obra geral (upsert). p_config pode ser parcial: o que não
-- vier fica com o valor efetivo atual. Chaves desconhecidas são ignoradas.
-- Valor inválido (fora dos CHECKs, tipo errado, nulo) → 22023. Devolve a
-- config efetiva gravada (como config_avisos_da_obra).
create or replace function salvar_config_avisos_obra(p_obra_id uuid, p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  perform public.contro_exige_planejar_geral(p_obra_id);
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Configuração inválida' using errcode = '22023';
  end if;
  v := to_jsonb(public.contro_config_avisos_obra(p_obra_id))
    || (p_config - 'obra_id' - 'updated_at' - 'updated_by' - 'personalizada');
  begin
    insert into public.config_avisos_obra (
      obra_id, reuniao_dia, reuniao_hora, manha_ativo, manha_hora, antes_ativo, antes_min,
      acoes_ativo, acoes_hora, pend_alta_du, pend_media_du, pend_baixa_du,
      provid_ativo, provid_hora, updated_by)
    values (
      p_obra_id,
      (v ->> 'reuniao_dia')::smallint, (v ->> 'reuniao_hora')::time,
      (v ->> 'manha_ativo')::boolean, (v ->> 'manha_hora')::time,
      (v ->> 'antes_ativo')::boolean, (v ->> 'antes_min')::smallint,
      (v ->> 'acoes_ativo')::boolean, (v ->> 'acoes_hora')::time,
      (v ->> 'pend_alta_du')::smallint, (v ->> 'pend_media_du')::smallint, (v ->> 'pend_baixa_du')::smallint,
      (v ->> 'provid_ativo')::boolean, (v ->> 'provid_hora')::time,
      public.contro_pessoa_atual())
    on conflict (obra_id) do update set
      reuniao_dia = excluded.reuniao_dia, reuniao_hora = excluded.reuniao_hora,
      manha_ativo = excluded.manha_ativo, manha_hora = excluded.manha_hora,
      antes_ativo = excluded.antes_ativo, antes_min = excluded.antes_min,
      acoes_ativo = excluded.acoes_ativo, acoes_hora = excluded.acoes_hora,
      pend_alta_du = excluded.pend_alta_du, pend_media_du = excluded.pend_media_du,
      pend_baixa_du = excluded.pend_baixa_du,
      provid_ativo = excluded.provid_ativo, provid_hora = excluded.provid_hora,
      updated_by = excluded.updated_by;
  exception
    when check_violation or not_null_violation or invalid_text_representation
      or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'Configuração inválida' using errcode = '22023';
  end;
  return public.config_avisos_da_obra(p_obra_id);
end;
$$;
revoke execute on function salvar_config_avisos_obra(uuid, jsonb) from public, anon;
grant execute on function salvar_config_avisos_obra(uuid, jsonb) to authenticated;

-- 2) Prazo da pendência com os dias úteis passados (a config da obra). Mesma
-- regra de contro_prazo_pendencia (prazoPendencia do core), que fica intacta.
create or replace function public.contro_prazo_pendencia_du(
  p_criticidade text, p_apontada_em timestamptz, p_alta int, p_media int, p_baixa int
)
returns date
language sql
stable
set search_path = ''
as $$
  select public.contro_add_du(
    (p_apontada_em at time zone 'America/Sao_Paulo')::date,
    case p_criticidade when 'alta' then p_alta
                       when 'media' then p_media
                       else p_baixa end
  );
$$;
revoke execute on function public.contro_prazo_pendencia_du(text, timestamptz, int, int, int) from public, anon, authenticated;

-- 3) Providência da obra geral: providenciar_ate gravado pelo banco ---------

-- Espelha deslocarDU de packages/core/src/calendar.ts: n >= 0 é addDU (n = 0
-- devolve a própria data, mesmo em fim de semana; para frente conta só dias
-- úteis); n < 0 volta n dias úteis. (contro_add_du não serve: n = 0 em fim de
-- semana vai para a segunda e n < 0 não volta.)
create or replace function public.contro_desloca_du(d date, n int)
returns date
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v date := d;
  k int := 0;
begin
  if n >= 0 then
    while k < n loop
      v := v + 1;
      if extract(isodow from v) <= 5 then k := k + 1; end if;
    end loop;
  else
    while k < -n loop
      v := v - 1;
      if extract(isodow from v) <= 5 then k := k + 1; end if;
    end loop;
  end if;
  return v;
end;
$$;
revoke execute on function public.contro_desloca_du(date, int) from public, anon, authenticated;

-- Espelha providenciarAteGeral (packages/core/src/obraGeralSemana.ts): prazo
-- efetivo da atividade (contro_prazo_atividade_geral: o último subitem com
-- data ou a data dela) menos a antecedência em dias úteis. Sem data: nulo.
-- Mudou lá? Mude aqui.
create or replace function public.contro_providenciar_ate_geral(p_atividade_id uuid, p_antecedencia_du int)
returns date
language sql
stable
set search_path = ''
as $$
  select public.contro_desloca_du(
    public.contro_prazo_atividade_geral(oa.id, oa.data_prevista),
    -greatest(0, coalesce(p_antecedencia_du, 0)))
  from public.obra_atividade oa where oa.id = p_atividade_id;
$$;
revoke execute on function public.contro_providenciar_ate_geral(uuid, int) from public, anon, authenticated;

-- A providência da obra geral sempre grava o prazo calculado (insert e update,
-- inclusive quem tentar gravar outro valor). Na Contorno, nada muda: o app
-- grava pelo atualizar_prazos_providencias.
create or replace function public.contro_providencia_prazo_geral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.obra where id = new.obra_id and ambiente = 'geral') then
    new.providenciar_ate := public.contro_providenciar_ate_geral(new.atividade_id, new.antecedencia_du);
  end if;
  return new;
end;
$$;
revoke execute on function public.contro_providencia_prazo_geral() from public, anon, authenticated;
create trigger obra_providencia_prazo_geral
  before insert or update on public.obra_providencia
  for each row execute function public.contro_providencia_prazo_geral();

-- A data da atividade muda (ou um subitem dela entra, muda de data, é
-- excluído/restaurado ou troca de pai): recalcula as providências da própria
-- atividade e da atividade de topo dela (o prazo efetivo segue o último subitem).
create or replace function public.contro_atividade_recalcula_providencias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_ids uuid[];
begin
  if tg_op = 'UPDATE'
     and new.data_prevista is not distinct from old.data_prevista
     and new.deleted_at is not distinct from old.deleted_at
     and new.pai_id is not distinct from old.pai_id then
    return null;
  end if;
  if not exists (select 1 from public.obra where id = new.obra_id and ambiente = 'geral') then
    return null;
  end if;
  v_ids := array_remove(array[new.id, new.pai_id,
    case when tg_op = 'UPDATE' then old.pai_id end], null);
  -- O gatilho obra_providencia_prazo_geral grava o valor; o filtro evita
  -- reescrever (e mexer no updated_at) o que já está certo.
  update public.obra_providencia op
     set providenciar_ate = public.contro_providenciar_ate_geral(op.atividade_id, op.antecedencia_du)
   where op.atividade_id = any (v_ids) and op.deleted_at is null
     and op.providenciar_ate is distinct from
         public.contro_providenciar_ate_geral(op.atividade_id, op.antecedencia_du);
  return null;
end;
$$;
revoke execute on function public.contro_atividade_recalcula_providencias() from public, anon, authenticated;
create trigger obra_atividade_recalcula_providencias
  after insert or update of data_prevista, deleted_at, pai_id on public.obra_atividade
  for each row execute function public.contro_atividade_recalcula_providencias();

-- Preenche as providências de obra geral que já existem.
update public.obra_providencia op
   set providenciar_ate = public.contro_providenciar_ate_geral(op.atividade_id, op.antecedencia_du)
  from public.obra o
 where o.id = op.obra_id and o.ambiente = 'geral' and op.deleted_at is null
   and op.providenciar_ate is distinct from
       public.contro_providenciar_ate_geral(op.atividade_id, op.antecedencia_du);

-- 4) Reunião da obra geral: a hora vem da config efetiva da obra -----------

-- Cópia literal de 20261106300000 §4; muda só a hora (config da obra → global
-- → 16:00, pela interna contro_config_avisos_obra).
create or replace function abrir_reuniao_geral(p_obra_id uuid, p_data date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_ambiente text; v_id uuid; v_status text;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
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
  -- Hora: a da config da obra (config_avisos_obra) → a global → 16:00.
  insert into public.reuniao (data, hora, obra_id)
  values (p_data,
    coalesce((public.contro_config_avisos_obra(p_obra_id)).reuniao_hora, '16:00'),
    p_obra_id)
  on conflict (obra_id, data) where obra_id is not null do nothing;
  select id, status into v_id, v_status from public.reuniao
  where obra_id = p_obra_id and data = p_data for update;
  if v_status <> 'fechada' then
    insert into public.reuniao_obra (reuniao_id, obra_id)
    values (v_id, p_obra_id)
    on conflict (reuniao_id, obra_id) do nothing;
  end if;
  return v_id;
end;
$$;

-- 5) Avisos do dia das obras gerais -----------------------------------------

-- Tipos de aviso: os lembretes de reunião da obra geral. O índice diário
-- parcial (tipo, dia, user_id) where tipo <> 'atribuicao' vale para eles.
alter table public.aviso_disparo drop constraint aviso_disparo_tipo_check;
alter table public.aviso_disparo add constraint aviso_disparo_tipo_check
  check (tipo in ('reuniao_manha','reuniao_antes','acoes','acoes_equipe','providencias','atribuicao',
                  'acoes_geral','equipe_geral','reuniao_manha_geral','reuniao_antes_geral'));

-- Cópia de 20261106200000 §5, com:
--   * config efetiva por obra (contro_config_avisos_obra), em vez da global;
--   * lembretes de reunião por obra, para quem participa da obra e os
--     Administradores ativos, no dia da reunião da obra:
--       reuniao_manha_geral: na janela de 3 h depois de manha_hora (que tem de
--         ser antes da reunião). Uma obra: "Reunião hoje às 16:00 · {obra}";
--         duas ou mais: "Reuniões hoje: {obra} 16:00 · {obra} 10:00" (pela
--         hora, depois pelo nome). Sai na hora mais cedo entre as obras da
--         pessoa e lista todas as dela com o lembrete ligado.
--       reuniao_antes_geral: de reuniao_hora − antes_min até a reunião,
--         "Começa em 30 min · {obra}". Um por pessoa por dia: vale para a
--         primeira reunião que entra na janela (limite aceito, decisão 7).
--       URL /?ir=geral-reuniao&obra=<id> (a primeira obra, pela hora).
--   * ações = atividades de topo abertas (sem tarefa vinculada aberta: a
--     tarefa a representa) + tarefas abertas + pendências abertas (prazo pela
--     config da obra) + providências pendentes sem tarefa vinculada aberta,
--     com providenciar_ate e atividade aberta; o dono da providência é o
--     responsável da atividade de topo dela (sem ele: Sem responsável).
--     Só obras com acoes_ativo; seg a sex. Um acoes_geral por pessoa (e um
--     equipe_geral por leitor) somando as obras: sai quando alguma obra com
--     ação vencida/de hoje dela está na janela de 3 h depois de acoes_hora,
--     ou seja, na hora mais cedo entre essas obras (o dedupe diário segura o resto).
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
      public.contro_prazo_pendencia_du(pe.criticidade, pe.apontada_em,
        cfg.pend_alta_du, cfg.pend_media_du, cfg.pend_baixa_du)
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
revoke execute on function gerar_avisos_gerais(timestamptz) from public, anon, authenticated;
