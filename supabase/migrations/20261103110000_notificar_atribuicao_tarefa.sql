-- Cada atribuição tem seu próprio aviso; resumos continuam únicos por dia.
alter table public.aviso_disparo drop constraint aviso_disparo_tipo_check;
alter table public.aviso_disparo add constraint aviso_disparo_tipo_check
  check (tipo in ('reuniao_manha','reuniao_antes','resumo','tarefas','providencias','atribuicao'));
alter table public.aviso_disparo drop constraint aviso_disparo_tipo_dia_user_id_key;
create unique index aviso_disparo_diario_unique on public.aviso_disparo(tipo,dia,user_id)
  where tipo <> 'atribuicao';

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
  v_atrasadas int;
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
    if c.resumo_ativo and v_hora >= c.resumo_hora and v_hora < c.resumo_hora + interval '3 hours' then
      select count(*) into v_atrasadas from public.tarefa t join public.obra o on o.id = t.obra_id
      where t.status = 'aberta' and t.deleted_at is null and t.prazo < v_hoje
        and o.status = 'ativa' and o.deleted_at is null;
      insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
      select 'resumo', v_hoje, p.user_id, 'CONTRO · Bom dia',
        v_obras || case when v_obras = 1 then ' obra em andamento' else ' obras em andamento' end
          || case when v_atrasadas > 0
               then ' e ' || v_atrasadas || case when v_atrasadas = 1 then ' tarefa atrasada' else ' tarefas atrasadas' end
               else '' end
          || '. Veja o que está atrasado e o que fazer hoje.',
        '/?ir=hoje'
      from public.pessoa p
      where p.ativo and p.deleted_at is null and p.user_id is not null
        and (c.resumo_para = 'todos' or p.perfil = 'gestor')
      on conflict (tipo, dia, user_id) where tipo <> 'atribuicao' do nothing;
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end if;

    -- Tarefas que vencem hoje: cada responsável recebe só as suas.
    if c.tarefas_ativo and v_hora >= c.tarefas_hora and v_hora < c.tarefas_hora + interval '3 hours' then
      insert into public.aviso_disparo (tipo, dia, user_id, titulo, corpo, url)
      select 'tarefas', v_hoje, p.user_id, 'CONTRO · Tarefas',
        case when count(*) = 1 then 'Você tem 1 tarefa para hoje: ' || min(t.texto)
             else 'Você tem ' || count(*) || ' tarefas para hoje: ' || min(t.texto) || ' e mais '
                  || (count(*) - 1) end,
        '/?ir=tarefas'
      from public.tarefa t
      join public.obra o on o.id = t.obra_id and o.status = 'ativa' and o.deleted_at is null
      join public.pessoa p on p.id = t.responsavel_id
      where t.status = 'aberta' and t.deleted_at is null and t.prazo = v_hoje
        and p.ativo and p.deleted_at is null and p.user_id is not null
      group by p.user_id
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

-- No banco: cobre criação, edição, ata e sincronização offline.
create or replace function public.notificar_atribuicao_tarefa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_obra text;
begin
  if new.responsavel_id is null or new.deleted_at is not null or new.status <> 'aberta' then
    return new;
  end if;
  if TG_OP = 'UPDATE' then
    if new.responsavel_id is not distinct from old.responsavel_id then return new; end if;
  end if;
  select user_id into v_user from public.pessoa
    where id = new.responsavel_id and ativo and deleted_at is null;
  if v_user is null then return new; end if;
  select nome into v_obra from public.obra where id = new.obra_id;
  insert into public.aviso_disparo(tipo,dia,user_id,titulo,corpo,url)
  values ('atribuicao', (now() at time zone 'America/Sao_Paulo')::date, v_user,
    'CONTRO · Tarefa atribuída a você',
    new.texto || ' · ' || coalesce(v_obra, 'Obra') || ' · Prazo: ' || to_char(new.prazo, 'DD/MM/YYYY'),
    '/?ir=minhas');
  return new;
end;
$$;
revoke all on function public.notificar_atribuicao_tarefa() from public, anon, authenticated;
create trigger tarefa_notificar_atribuicao
  after insert or update of responsavel_id on public.tarefa
  for each row execute function public.notificar_atribuicao_tarefa();
