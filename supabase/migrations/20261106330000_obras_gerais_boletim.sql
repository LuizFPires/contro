-- Obras gerais · Etapa 4 (decisão 8): boletim por obra geral.
--   * config_boletim_obra: agendamento por obra geral (mesmas colunas e CHECKs
--     da config_boletim). Sem linha = a obra não tem boletim automático.
--     Lê quem vê a obra; grava só Administrador, por salvar_config_boletim_obra.
--   * gerar_disparos_boletim_geral (cron boletim-geral): espelha
--     gerar_disparos_boletim (20261105230000) para as obras gerais ativas com
--     config ativa; grava boletim_disparo e um aviso boletim_geral por
--     destinatário (Coordenadores da obra + Administradores ativos).
--   * Marcar enviado (update de boletim_disparo): Contorno como hoje (gestor);
--     obra geral = quem planeja a obra.
-- A Contorno não muda: config_boletim, gerar_disparos_boletim e o cron
-- boletim-gerar-disparos ficam como estão.

-- 1) Config por obra --------------------------------------------------------

create table config_boletim_obra (
  obra_id uuid primary key references obra (id) on delete cascade,
  ativo boolean not null default true,
  dia_semana smallint not null default 1 check (dia_semana between 1 and 7),
  hora time not null default '06:30',
  fechamento_ativo boolean not null default false,
  fechamento_dia smallint not null default 5 check (fechamento_dia between 1 and 7),
  fechamento_hora time not null default '17:00',
  updated_at timestamptz not null default now(),
  updated_by uuid references pessoa (id)
);
create trigger config_boletim_obra_set_updated_at before update on config_boletim_obra
  for each row execute function set_updated_at();

alter table config_boletim_obra enable row level security;
-- Só leitura direta; escrita pela função abaixo.
create policy config_boletim_obra_sel on config_boletim_obra for select to authenticated
  using (contro_ve_obra(obra_id));
revoke insert, update, delete on config_boletim_obra from anon, authenticated;

-- Grava a config da obra geral (upsert). p_config pode ser parcial: o que não
-- vier fica com o valor atual (sem linha: os padrões da tabela). Chaves
-- desconhecidas são ignoradas. Obra inexistente → 23503; Contorno → 23505;
-- quem não é Administrador → 42501; valor inválido → 22023. Devolve a linha
-- gravada (sem updated_at/updated_by).
create or replace function salvar_config_boletim_obra(p_obra_id uuid, p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ambiente text;
  v jsonb;
  r public.config_boletim_obra%rowtype;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select ambiente into v_ambiente from public.obra where id = p_obra_id and deleted_at is null;
  if v_ambiente is null or not public.contro_ve_obra(p_obra_id) then
    raise exception 'Obra inválida' using errcode = '23503';
  end if;
  if v_ambiente <> 'geral' then
    raise exception 'Obra da Contorno: use a configuração da Contorno' using errcode = '23505';
  end if;
  if not public.contro_e_admin() then
    raise exception 'Só o Administrador configura o boletim' using errcode = '42501';
  end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Configuração inválida' using errcode = '22023';
  end if;

  v := coalesce(
    (select to_jsonb(c) from public.config_boletim_obra c where c.obra_id = p_obra_id),
    jsonb_build_object('ativo', true, 'dia_semana', 1, 'hora', '06:30',
      'fechamento_ativo', false, 'fechamento_dia', 5, 'fechamento_hora', '17:00'))
    || (p_config - 'obra_id' - 'updated_at' - 'updated_by');
  begin
    insert into public.config_boletim_obra (
      obra_id, ativo, dia_semana, hora, fechamento_ativo, fechamento_dia, fechamento_hora, updated_by)
    values (
      p_obra_id,
      (v ->> 'ativo')::boolean, (v ->> 'dia_semana')::smallint, (v ->> 'hora')::time,
      (v ->> 'fechamento_ativo')::boolean, (v ->> 'fechamento_dia')::smallint,
      (v ->> 'fechamento_hora')::time,
      public.contro_pessoa_atual())
    on conflict (obra_id) do update set
      ativo = excluded.ativo, dia_semana = excluded.dia_semana, hora = excluded.hora,
      fechamento_ativo = excluded.fechamento_ativo, fechamento_dia = excluded.fechamento_dia,
      fechamento_hora = excluded.fechamento_hora, updated_by = excluded.updated_by
    returning * into r;
  exception
    when check_violation or not_null_violation or invalid_text_representation
      or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'Configuração inválida' using errcode = '22023';
  end;
  return to_jsonb(r) - 'updated_at' - 'updated_by';
end;
$$;
revoke execute on function salvar_config_boletim_obra(uuid, jsonb) from public, anon;
grant execute on function salvar_config_boletim_obra(uuid, jsonb) to authenticated;

-- 2) Marcar enviado ---------------------------------------------------------
-- Contorno: o gestor (como hoje). Obra geral: quem planeja (Coordenador da
-- obra, Administrador): contro_coordena_obra, que é o contro_planeja_obra
-- restrito a obra geral (o planeja é verdadeiro para qualquer membro na
-- Contorno). A guarda a_guarda_obra continua valendo.
drop policy boletim_disparo_upd on boletim_disparo;
create policy boletim_disparo_upd on boletim_disparo for update to authenticated
  using (
    (contro_perfil() = 'gestor' and exists (
      select 1 from public.obra o where o.id = obra_id and o.ambiente = 'contorno'))
    or (contro_coordena_obra(obra_id))
  )
  with check (
    (contro_perfil() = 'gestor' and exists (
      select 1 from public.obra o where o.id = obra_id and o.ambiente = 'contorno'))
    or (contro_coordena_obra(obra_id))
  );

-- 3) Disparos das obras gerais ----------------------------------------------

-- Tipos de aviso: o boletim da obra geral (mantém todos os de 20261106320000).
alter table public.aviso_disparo drop constraint aviso_disparo_tipo_check;
alter table public.aviso_disparo add constraint aviso_disparo_tipo_check
  check (tipo in ('reuniao_manha','reuniao_antes','acoes','acoes_equipe','providencias','atribuicao',
                  'acoes_geral','equipe_geral','reuniao_manha_geral','reuniao_antes_geral',
                  'boletim_geral'));

-- Espelha gerar_disparos_boletim (20261105230000) por obra geral: mesma regra
-- de horário (fuso America/Sao_Paulo; principal e fechamento; dedupe por
-- obra, semana e edição), com a config da obra (config_boletim_obra ativa).
-- O push vai pelo aviso_disparo (enviar-avisos), então o disparo já nasce
-- com notificado_em: o enviar-push-boletim (gestores da Contorno) não o pega.
-- Avisos: um boletim_geral por destinatário com os disparos novos desta
-- rodada (Coordenadores da obra + Administradores ativos). Uma obra:
-- "Boletim pronto · {obra}"; duas ou mais: "Boletins prontos · {obra} · {obra}"
-- (pelo nome). URL /?ir=geral-boletim&obra=<id> (a primeira, pelo nome).
-- Um por pessoa por dia (índice diário): outro disparo da mesma pessoa mais
-- tarde no mesmo dia não gera segundo aviso (limite aceito, como na decisão 7).
-- Roda só pelo pg_cron (sem grant a authenticated). Devolve os disparos novos.
create or replace function gerar_disparos_boletim_geral(p_agora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local timestamp := p_agora at time zone 'America/Sao_Paulo';
  v_isodow int := extract(isodow from v_local)::int;
  v_hora time := v_local::time;
  v_semana date := date_trunc('week', v_local)::date; -- segunda da semana
  v_total int;
begin
  with cfg as (
    select c.*
    from public.obra o
    join public.config_boletim_obra c on c.obra_id = o.id
    where o.ambiente = 'geral' and o.status = 'ativa' and o.deleted_at is null and c.ativo
  ),
  devidos as (
    select obra_id, 'principal'::public.boletim_edicao as edicao
    from cfg where v_isodow = dia_semana and v_hora >= hora
    union all
    select obra_id, 'fechamento'::public.boletim_edicao
    from cfg where fechamento_ativo and v_isodow = fechamento_dia and v_hora >= fechamento_hora
  ),
  novos as (
    insert into public.boletim_disparo (obra_id, semana_inicio, edicao, notificado_em)
    select obra_id, v_semana, edicao, now() from devidos
    on conflict (obra_id, semana_inicio, edicao) do nothing
    returning obra_id
  ),
  destinos as (
    select distinct p.user_id, o.id as obra_id, o.nome
    from (select distinct obra_id from novos) n
    join public.obra o on o.id = n.obra_id
    join public.pessoa p on p.ativo and p.deleted_at is null and p.user_id is not null
      and (p.administrador or (p.papel_geral = 'coordenador' and exists (
        select 1 from public.obra_participante op
        where op.obra_id = o.id and op.pessoa_id = p.id)))
  ),
  por_pessoa as (
    select user_id, count(*)::int as n,
      string_agg(nome, ' · ' order by nome, obra_id) as lista,
      (array_agg(obra_id order by nome, obra_id))[1] as obra_id
    from destinos
    group by user_id
  ),
  avisos as (
    insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
    select 'boletim_geral', v_local::date, user_id, 'CONTRO · Boletim',
      case when n = 1 then 'Boletim pronto · ' || lista else 'Boletins prontos · ' || lista end,
      '/?ir=geral-boletim&obra=' || obra_id
    from por_pessoa
    on conflict (tipo, dia, user_id) where tipo <> 'atribuicao' do nothing
    returning 1
  )
  select count(*)::int into v_total from novos;

  return v_total;
end;
$$;
revoke all on function public.gerar_disparos_boletim_geral(timestamptz) from public, anon, authenticated;

-- A cada 15 min (a função checa o horário por dentro). Idempotente.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'boletim-geral') then
      perform cron.unschedule('boletim-geral');
    end if;
    perform cron.schedule('boletim-geral', '*/15 * * * *', 'select public.gerar_disparos_boletim_geral();');
  end if;
end $$;
